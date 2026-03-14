import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_SCHEME = "danhausa";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type") || "email";
    const webUrl = url.searchParams.get("web_url");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const resolvedToken = tokenHash || token;

    if (!resolvedToken) {
      return new Response(buildErrorPage("Invalid or missing confirmation token."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const otpType = type === "recovery" ? "recovery" : "email";

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: resolvedToken,
      type: otpType as "email" | "recovery",
    });

    if (error || !data.session) {
      return new Response(buildErrorPage("This confirmation link has expired or already been used. Please request a new one."), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    const { access_token, refresh_token } = data.session;
    const deepLinkPath = `/auth/confirm#access_token=${access_token}&refresh_token=${refresh_token}&type=${otpType}`;

    if (webUrl) {
      const decodedWebUrl = decodeURIComponent(webUrl);
      const webRedirect = `${decodedWebUrl}#access_token=${access_token}&refresh_token=${refresh_token}&type=${otpType}`;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: webRedirect },
      });
    }

    const appDeepLink = `${APP_SCHEME}:/${deepLinkPath}`;

    return new Response(buildRedirectPage(appDeepLink), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (err) {
    return new Response(buildErrorPage("Something went wrong. Please try again."), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  }
});

function buildRedirectPage(appDeepLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Confirmed - Danhausa</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a1a, #3d2200);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      width: 72px; height: 72px;
      background: #f0fdf4;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 32px;
    }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 10px; font-weight: 700; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; margin-bottom: 28px; }
    .btn {
      display: block;
      background: linear-gradient(to right, #f97316, #e85d04);
      color: white;
      text-decoration: none;
      padding: 16px 24px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      cursor: pointer;
      border: none;
      width: 100%;
    }
    .expogo-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #f3f4f6;
    }
    .expogo-label { font-size: 13px; color: #9ca3af; margin-bottom: 10px; }
    .expogo-input {
      width: 100%; padding: 12px 14px; border: 1.5px solid #e5e7eb;
      border-radius: 10px; font-size: 14px; color: #374151;
      margin-bottom: 10px; outline: none;
    }
    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
      font-size: 14px;
      padding: 13px 24px;
    }
    .spinner {
      width: 20px; height: 20px;
      border: 3px solid #fed7aa;
      border-top-color: #f97316;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Email Confirmed!</h1>
    <p>Your email has been verified. Opening the Danhausa app...</p>
    <a href="${appDeepLink}" class="btn" id="openBtn">
      <span class="spinner"></span> Opening App...
    </a>
    <div class="expogo-section">
      <p class="expogo-label">Testing with Expo Go? Enter your local IP:</p>
      <input class="expogo-input" id="ipInput" placeholder="e.g. 192.168.1.5" />
      <button class="btn btn-secondary" onclick="openExpoGo()">Open in Expo Go</button>
    </div>
  </div>
  <script>
    var appLink = "${appDeepLink}";
    var deepPath = appLink.replace("${APP_SCHEME}:/", "");
    window.location.href = appLink;
    setTimeout(function() {
      document.getElementById('openBtn').textContent = 'Open Danhausa App';
    }, 2500);
    function openExpoGo() {
      var ip = document.getElementById('ipInput').value.trim();
      if (!ip) { alert('Please enter your local IP address'); return; }
      window.location.href = 'exp://' + ip + ':8081/--' + deepPath;
    }
  </script>
</body>
</html>`;
}

function buildErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation Error - Danhausa</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a1a, #3d2200);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 10px; font-weight: 700; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>Link Expired</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
