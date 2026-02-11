import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { email, amount, orderId, metadata } = await req.json();

    if (!email || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and amount are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Paystack secret key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInKobo = Math.round(amount * 100);

    const initializeUrl = "https://api.paystack.co/transaction/initialize";
    const payload: Record<string, unknown> = {
      email,
      amount: amountInKobo,
    };
    if (orderId) {
      payload.reference = orderId;
    }
    if (metadata || orderId) {
      payload.metadata = { ...metadata, orderId };
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
      return new Response(
        JSON.stringify({
          success: false,
          error: initializeData.message || "Failed to initialize payment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          authorization_url: initializeData.data.authorization_url,
          reference: initializeData.data.reference,
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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
