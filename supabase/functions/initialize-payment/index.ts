import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, amount, orderId, metadata, pendingOrderSnapshot, source, customerId } = await req.json();

    if (!email || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and amount are required" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Paystack secret key not configured" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInKobo = Math.round(amount * 100);

    const initializeUrl = "https://api.paystack.co/transaction/initialize";
    const safeReference = orderId
      ? orderId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 100)
      : undefined;

    const payload: Record<string, unknown> = {
      email,
      amount: amountInKobo,
    };
    if (safeReference) {
      payload.reference = safeReference;
    }
    if (metadata || orderId) {
      payload.metadata = { ...metadata, orderId };
    }
    // Ensure type is always present so the webhook can distinguish order payments from wallet recharges
    if (!payload.metadata) {
      payload.metadata = {};
    }
    if (!(payload.metadata as any).type) {
      (payload.metadata as any).type = 'order';
    }

    const initializeResponse = await fetch(initializeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const initializeData = await initializeResponse.json();

    if (!initializeResponse.ok || !initializeData.status) {
      console.error("Paystack API Error:", initializeResponse.status, JSON.stringify(initializeData));
      return new Response(
        JSON.stringify({
          success: false,
          error: initializeData.message || "Failed to initialize payment",
          paystackStatus: initializeResponse.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const reference = initializeData.data.reference;

    // Save pending order server-side using service role — guaranteed even if user's
    // session expires or they never return to the app after paying
    if (pendingOrderSnapshot && customerId && source) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);
        const { error: insertError } = await adminClient
          .from("pending_orders")
          .insert({
            paystack_reference: reference,
            source,
            customer_id: customerId,
            order_data: pendingOrderSnapshot,
          });
        if (insertError) {
          console.error("Failed to save pending order:", insertError);
        }
      } catch (e) {
        console.error("Pending order save error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: initializeData.data.authorization_url,
          reference,
          access_code: initializeData.data.access_code,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Payment initialization error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during payment initialization",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
