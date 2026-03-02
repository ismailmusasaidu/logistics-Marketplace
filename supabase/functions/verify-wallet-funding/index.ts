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
    const { reference } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment reference is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!reference.startsWith("wallet_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid wallet funding reference" }),
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

    const { data: rechargeRecord, error: rechargeError } = await supabaseClient
      .from("wallet_recharges")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (rechargeError || !rechargeRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet recharge record not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (rechargeRecord.status === "completed") {
      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          message: "Payment already verified",
          amount: rechargeRecord.amount,
          reference: reference,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.status) {
      await supabaseClient
        .from("wallet_recharges")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", rechargeRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment verification failed with Paystack",
          details: verifyData.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transactionData = verifyData.data;

    if (transactionData.status !== "success") {
      let errorMessage = "Payment was not successful";

      switch (transactionData.status) {
        case "failed":
          errorMessage = transactionData.gateway_response || "Payment failed. Please try again.";
          break;
        case "abandoned":
          errorMessage = "Payment was abandoned. Please complete your payment.";
          break;
        case "cancelled":
          errorMessage = "Payment was cancelled.";
          break;
        default:
          errorMessage = `Payment status: ${transactionData.status}`;
      }

      await supabaseClient
        .from("wallet_recharges")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", rechargeRecord.id);

      const { data: userProfile } = await supabaseClient
        .from("profiles")
        .select("email, full_name")
        .eq("id", rechargeRecord.user_id)
        .maybeSingle();

      if (userProfile?.email) {
        sendEmailNotification("wallet_funding_failed", userProfile.email, {
          customerName: userProfile.full_name,
          amount: rechargeRecord.amount,
          reference: reference,
          failureReason: errorMessage,
        });
      }

      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          status: transactionData.status,
          message: errorMessage,
          gatewayResponse: transactionData.gateway_response,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountPaid = transactionData.amount / 100;

    if (Math.abs(amountPaid - rechargeRecord.amount) > 0.01) {
      console.error(
        `Amount mismatch: expected ${rechargeRecord.amount}, got ${amountPaid}`
      );
      await supabaseClient
        .from("wallet_recharges")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", rechargeRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment amount mismatch",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: addBalanceResult, error: addBalanceError } = await supabaseClient
      .rpc("add_wallet_balance", {
        p_user_id: rechargeRecord.user_id,
        p_amount: amountPaid,
        p_description: `Wallet funding via Paystack - ${reference}`,
        p_reference_type: "recharge",
      });

    if (addBalanceError || !addBalanceResult) {
      console.error("Failed to add wallet balance:", addBalanceError);
      await supabaseClient
        .from("wallet_recharges")
        .update({ status: "failed", failed_at: new Date().toISOString() })
        .eq("id", rechargeRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to credit wallet",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await supabaseClient
      .from("wallet_recharges")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        paystack_reference: transactionData.reference,
      })
      .eq("id", rechargeRecord.id);

    const { data: userProfile } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", rechargeRecord.user_id)
      .maybeSingle();

    const { data: walletData } = await supabaseClient
      .from("wallets")
      .select("balance")
      .eq("user_id", rechargeRecord.user_id)
      .maybeSingle();

    if (userProfile?.email) {
      sendEmailNotification("wallet_funded_card", userProfile.email, {
        customerName: userProfile.full_name,
        amount: amountPaid,
        reference: reference,
        newBalance: walletData?.balance ? `₦${walletData.balance.toLocaleString()}` : "N/A",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        message: "Wallet funded successfully",
        amount: amountPaid,
        reference: reference,
        paidAt: transactionData.paid_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Wallet funding verification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during wallet funding verification",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
