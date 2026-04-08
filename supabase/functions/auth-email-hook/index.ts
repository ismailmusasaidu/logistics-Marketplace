import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, string>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function getEmailTemplate(
  actionType: string,
  token: string,
  userName: string
): { subject: string; html: string } {
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 16px; padding: 36px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); }
    .logo { font-size: 22px; font-weight: 700; color: #f97316; margin-bottom: 4px; text-align: center; }
    .logo-sub { font-size: 12px; color: #9ca3af; text-align: center; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 28px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 12px 0; text-align: center; }
    .subtitle { font-size: 14px; color: #6b7280; text-align: center; margin-bottom: 28px; line-height: 1.6; }
    .otp-box { background: linear-gradient(135deg, #fff7ed, #ffedd5); border: 2px solid #fed7aa; border-radius: 14px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-label { font-size: 12px; color: #9a3412; letter-spacing: 2px; text-transform: uppercase; font-weight: 600; margin-bottom: 10px; }
    .otp-code { font-size: 40px; font-weight: 700; color: #ea580c; letter-spacing: 10px; font-family: monospace; }
    .expiry { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 6px; }
    .warning { background-color: #fafafa; border-radius: 10px; padding: 14px; margin-top: 20px; }
    .warning-text { font-size: 13px; color: #6b7280; text-align: center; line-height: 1.5; }
    .footer { text-align: center; margin-top: 28px; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 12px; line-height: 1.7; }
  `;

  const wrap = (content: string, subject: string) => ({
    subject,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${baseStyle}</style></head><body><div class="container"><div class="card">${content}</div><div class="footer"><p>This is an automated security email from Danhausa. Do not share this code with anyone.</p><p>If you did not request this, you can safely ignore this email.</p></div></div></body></html>`,
  });

  if (actionType === "signup") {
    return wrap(
      `
      <div class="logo">Danhausa</div>
      <div class="logo-sub">Email Verification</div>
      <h1>Verify Your Email</h1>
      <p class="subtitle">Hi ${userName || "there"}, enter this code to activate your account.</p>
      <div class="otp-box">
        <div class="otp-label">Verification Code</div>
        <div class="otp-code">${token}</div>
        <div class="expiry">Expires in 1 hour</div>
      </div>
      <div class="warning">
        <p class="warning-text">Enter this code in the app to complete your registration. Never share this code with anyone.</p>
      </div>
      `,
      "Verify your Danhausa account"
    );
  }

  if (actionType === "recovery") {
    return wrap(
      `
      <div class="logo">Danhausa</div>
      <div class="logo-sub">Password Reset</div>
      <h1>Reset Your Password</h1>
      <p class="subtitle">Hi ${userName || "there"}, use this code to reset your password.</p>
      <div class="otp-box">
        <div class="otp-label">Reset Code</div>
        <div class="otp-code">${token}</div>
        <div class="expiry">Expires in 1 hour</div>
      </div>
      <div class="warning">
        <p class="warning-text">Enter this code in the app to set a new password. Never share this code with anyone.</p>
      </div>
      `,
      "Reset your Danhausa password"
    );
  }

  if (actionType === "email_change") {
    return wrap(
      `
      <div class="logo">Danhausa</div>
      <div class="logo-sub">Email Change</div>
      <h1>Confirm Email Change</h1>
      <p class="subtitle">Hi ${userName || "there"}, use this code to confirm your new email address.</p>
      <div class="otp-box">
        <div class="otp-label">Confirmation Code</div>
        <div class="otp-code">${token}</div>
        <div class="expiry">Expires in 1 hour</div>
      </div>
      <div class="warning">
        <p class="warning-text">Enter this code in the app to confirm your new email. Never share this code with anyone.</p>
      </div>
      `,
      "Confirm your Danhausa email change"
    );
  }

  if (actionType === "magiclink" || actionType === "email") {
    return wrap(
      `
      <div class="logo">Danhausa</div>
      <div class="logo-sub">Sign In</div>
      <h1>Your Sign In Code</h1>
      <p class="subtitle">Hi ${userName || "there"}, use this code to sign in to your account.</p>
      <div class="otp-box">
        <div class="otp-label">Sign In Code</div>
        <div class="otp-code">${token}</div>
        <div class="expiry">Expires in 1 hour</div>
      </div>
      <div class="warning">
        <p class="warning-text">Enter this code in the app to sign in. Never share this code with anyone.</p>
      </div>
      `,
      "Your Danhausa sign in code"
    );
  }

  return wrap(
    `
    <div class="logo">Danhausa</div>
    <div class="logo-sub">Verification</div>
    <h1>Your Verification Code</h1>
    <p class="subtitle">Hi ${userName || "there"}, use this code to complete your request.</p>
    <div class="otp-box">
      <div class="otp-label">Code</div>
      <div class="otp-code">${token}</div>
      <div class="expiry">Expires in 1 hour</div>
    </div>
    `,
    "Your Danhausa verification code"
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: EmailHookPayload = await req.json();
    const { user, email_data } = payload;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@danhausalogistics.com";
    const userName = user.user_metadata?.full_name || user.email?.split("@")[0] || "there";
    const actionType = email_data.email_action_type;
    const token = email_data.token;

    const { subject, html } = getEmailTemplate(actionType, token, userName);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [user.email],
        subject,
        html,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", JSON.stringify(responseData));
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${JSON.stringify(responseData)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth email sent via Resend to:", user.email, "type:", actionType, "id:", responseData.id);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Auth email hook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
