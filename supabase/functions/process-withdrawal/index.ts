import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function sendEmailNotification(template: string, to: string, data: Record<string, any>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, to, data }),
    });
    if (!response.ok) {
      console.error("Failed to send email:", await response.text());
    }
  } catch (error) {
    console.error("Email notification error:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { withdrawalId } = await req.json();

    if (!withdrawalId) {
      return new Response(
        JSON.stringify({ success: false, error: "Withdrawal ID is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Payment service configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: withdrawal, error: withdrawalError } = await supabaseClient
      .from("wallet_withdrawals")
      .select(`
        *,
        bank_account:user_bank_accounts(*)
      `)
      .eq("id", withdrawalId)
      .maybeSingle();

    if (withdrawalError || !withdrawal) {
      return new Response(
        JSON.stringify({ success: false, error: "Withdrawal not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (withdrawal.status !== "pending") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Withdrawal is already ${withdrawal.status}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const bankAccount = withdrawal.bank_account;
    if (!bankAccount || !bankAccount.is_verified) {
      await supabaseClient
        .from("wallet_withdrawals")
        .update({
          status: "failed",
          failure_reason: "Bank account not verified",
          failed_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      await supabaseClient.rpc("refund_failed_withdrawal", {
        p_withdrawal_id: withdrawalId,
      });

      return new Response(
        JSON.stringify({ success: false, error: "Bank account not verified" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabaseClient
      .from("wallet_withdrawals")
      .update({
        status: "processing",
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", withdrawal.user_id)
      .maybeSingle();

    if (userProfile?.email) {
      sendEmailNotification("withdrawal_requested", userProfile.email, {
        customerName: userProfile.full_name,
        amount: withdrawal.amount,
        bankName: bankAccount.bank_name,
        accountName: bankAccount.account_name,
        accountNumber: bankAccount.account_number,
        fee: withdrawal.fee,
        netAmount: withdrawal.net_amount,
        reference: withdrawal.reference,
      });
    }

    let recipientCode = bankAccount.recipient_code;

    if (!recipientCode) {
      const createRecipientUrl = "https://api.paystack.co/transferrecipient";
      const recipientResponse = await fetch(createRecipientUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "nuban",
          name: bankAccount.account_name,
          account_number: bankAccount.account_number,
          bank_code: bankAccount.bank_code,
          currency: "NGN",
        }),
      });

      const recipientData = await recipientResponse.json();

      if (!recipientResponse.ok || !recipientData.status) {
        await supabaseClient
          .from("wallet_withdrawals")
          .update({
            status: "failed",
            failure_reason: recipientData.message || "Failed to create transfer recipient",
            failed_at: new Date().toISOString(),
          })
          .eq("id", withdrawalId);

        await supabaseClient.rpc("refund_failed_withdrawal", {
          p_withdrawal_id: withdrawalId,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to create transfer recipient",
            details: recipientData.message,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      recipientCode = recipientData.data.recipient_code;

      await supabaseClient
        .from("user_bank_accounts")
        .update({ recipient_code: recipientCode })
        .eq("id", bankAccount.id);
    }

    const amountInKobo = Math.round(withdrawal.net_amount * 100);

    const transferUrl = "https://api.paystack.co/transfer";
    const transferResponse = await fetch(transferUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amountInKobo,
        recipient: recipientCode,
        reason: `Wallet withdrawal - ${withdrawal.reference}`,
        reference: withdrawal.reference,
      }),
    });

    const transferData = await transferResponse.json();

    if (!transferResponse.ok || !transferData.status) {
      await supabaseClient
        .from("wallet_withdrawals")
        .update({
          status: "failed",
          failure_reason: transferData.message || "Transfer failed",
          failed_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      await supabaseClient.rpc("refund_failed_withdrawal", {
        p_withdrawal_id: withdrawalId,
      });

      if (userProfile?.email) {
        sendEmailNotification("withdrawal_failed", userProfile.email, {
          customerName: userProfile.full_name,
          amount: withdrawal.amount,
          reference: withdrawal.reference,
          failureReason: transferData.message || "Transfer failed",
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "Transfer failed",
          details: transferData.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabaseClient
      .from("wallet_withdrawals")
      .update({
        status: "completed",
        paystack_reference: transferData.data.reference,
        completed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    if (userProfile?.email) {
      sendEmailNotification("withdrawal_completed", userProfile.email, {
        customerName: userProfile.full_name,
        netAmount: withdrawal.net_amount,
        bankName: bankAccount.bank_name,
        accountName: bankAccount.account_name,
        accountNumber: bankAccount.account_number,
        reference: withdrawal.reference,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Withdrawal processed successfully",
        reference: withdrawal.reference,
        amount: withdrawal.net_amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Withdrawal processing error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during withdrawal processing",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
