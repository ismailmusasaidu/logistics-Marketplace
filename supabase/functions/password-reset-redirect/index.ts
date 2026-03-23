import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_SCHEME = "danhausa";
const FORGOT_PASSWORD_DEEP_LINK = `${APP_SCHEME}:///auth/forgot-password`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tokenHash = url.searchParams.get("token_hash");
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");
    const type = url.searchParams.get("type");
    const webUrl = url.searchParams.get("web_url");
    const errorParam = url.searchParams.get("error");

    // Handle error forwarded from fragment bridge
    if (errorParam) {
      return new Response(
        buildErrorPage(
          "This password reset link has expired or has already been used. Please request a new one.",
          FORGOT_PASSWORD_DEEP_LINK
        ),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    // No token params — Supabase delivered them as a URL fragment (#...).
    // Serve a bridge page that reads them client-side and reloads with query params.
    if (!tokenHash && !accessToken) {
      return new Response(buildFragmentBridgePage(), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html" },
      });
    }

    if (type !== "recovery") {
      return new Response(
        buildErrorPage("Invalid or missing reset token.", FORGOT_PASSWORD_DEEP_LINK),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    }

    let access_token: string;
    let refresh_token: string;

    if (accessToken && refreshToken) {
      access_token = accessToken;
      refresh_token = refreshToken;
    } else {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: "recovery",
      });

      if (error || !data.session) {
        return new Response(
          buildErrorPage(
            "This password reset link has expired or has already been used. Please request a new one.",
            FORGOT_PASSWORD_DEEP_LINK
          ),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html" } }
        );
      }

      access_token = data.session.access_token;
      refresh_token = data.session.refresh_token;
    }

    const tokenParams = `access_token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token)}&type=recovery`;
    const deepLinkPath = `auth/reset-password?${tokenParams}`;

    if (webUrl) {
      const decodedWebUrl = decodeURIComponent(webUrl);
      const webRedirect = `${decodedWebUrl}#access_token=${access_token}&refresh_token=${refresh_token}&type=recovery`;
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: webRedirect },
      });
    }

    const appDeepLink = `${APP_SCHEME}://${deepLinkPath}`;

    return new Response(buildRedirectPage(appDeepLink), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (err) {
    return new Response(
      buildErrorPage("Something went wrong. Please request a new reset link.", FORGOT_PASSWORD_DEEP_LINK),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "text/html" } }
    );
  }
});

function buildFragmentBridgePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifying reset link...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #ff8c00, #ff4500);
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
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .spinner {
      width: 48px; height: 48px;
      border: 4px solid #fed7aa;
      border-top-color: #f97316;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 20px; color: #1a1a1a; margin-bottom: 10px; font-weight: 700; }
    p { font-size: 15px; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Verifying your link...</h1>
    <p>Please wait while we confirm your reset request.</p>
  </div>
  <script>
    (function () {
      var hash = window.location.hash.substring(1);
      if (!hash) {
        window.location.href = window.location.pathname + '?error=no_token';
        return;
      }
      var params = new URLSearchParams(hash);
      var errorCode = params.get('error') || params.get('error_code');
      var tokenHash = params.get('token_hash');
      var accessToken = params.get('access_token');
      var refreshToken = params.get('refresh_token');
      var type = params.get('type');

      if (errorCode) {
        window.location.href = window.location.pathname + '?error=' + encodeURIComponent(errorCode);
        return;
      }

      if ((tokenHash || accessToken) && type) {
        var query = new URLSearchParams();
        if (tokenHash) query.set('token_hash', tokenHash);
        if (accessToken) query.set('access_token', accessToken);
        if (refreshToken) query.set('refresh_token', refreshToken);
        query.set('type', type);
        window.location.href = window.location.pathname + '?' + query.toString();
      } else {
        window.location.href = window.location.pathname + '?error=invalid_token';
      }
    })();
  </script>
</body>
</html>`;
}

function buildRedirectPage(appDeepLink: string): string {
  const deepPath = appDeepLink.replace(`${APP_SCHEME}:/`, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Opening Danhausa...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #ff8c00, #ff4500);
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
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .icon {
      width: 72px; height: 72px;
      background: #fff7ed;
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
    .status { font-size: 13px; color: #9ca3af; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#128272;</div>
    <h1>Reset Your Password</h1>
    <p>Opening the Danhausa app to let you set a new password...</p>
    <a href="${appDeepLink}" class="btn" id="openBtn">
      <span class="spinner"></span> Opening App...
    </a>
    <p class="status" id="status">If the app doesn't open automatically, tap the button above.</p>
  </div>
  <script>
    (function() {
      var appLink = "${appDeepLink}";
      window.location.href = appLink;
      setTimeout(function() {
        document.getElementById('openBtn').innerHTML = 'Open Danhausa App';
        document.getElementById('status').textContent = 'App did not open automatically. Tap the button above.';
      }, 2500);
    })();
  </script>
</body>
</html>`;
}

function buildErrorPage(message: string, requestNewLinkDeepLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Link Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #ff8c00, #ff4500);
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
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .icon { font-size: 48px; margin-bottom: 20px; }
    h1 { font-size: 22px; color: #1a1a1a; margin-bottom: 12px; font-weight: 700; }
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
      cursor: pointer;
      border: none;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#9888;&#65039;</div>
    <h1>Link Expired</h1>
    <p>${message}</p>
    <a href="${requestNewLinkDeepLink}" class="btn">Request New Link</a>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "${requestNewLinkDeepLink}";
    }, 300);
  </script>
</body>
</html>`;
}
