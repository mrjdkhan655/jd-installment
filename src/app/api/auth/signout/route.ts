import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function POST(req: Request) {
  return handleSignOut();
}

export async function GET(req: Request) {
  return handleSignOut();
}

async function handleSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Fetch live branding name from settings
  const { data: settings } = await supabase
    .from("business_settings")
    .select("business_name, business_phone, business_email")
    .eq("id", 1)
    .single();

  const brandName = settings?.business_name || "InstallPro";
  const brandInitial = brandName.charAt(0).toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Signed Out — ${brandName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #F7F8FA;
      color: #111418;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      width: 100%;
      max-width: 440px;
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 36px 28px;
      box-shadow: 0 4px 20px -2px rgba(15, 76, 58, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
      text-align: center;
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .brand-row {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .brand-logo {
      width: 40px;
      height: 40px;
      background: #0F4C3A;
      color: #FFFFFF;
      font-size: 18px;
      font-weight: 800;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(15, 76, 58, 0.25);
    }
    .brand-title {
      font-size: 18px;
      font-weight: 700;
      color: #111418;
      letter-spacing: -0.02em;
    }
    .status-icon {
      width: 56px;
      height: 56px;
      background: #EAF3EF;
      border: 2px solid #BBF7D0;
      border-radius: 50%;
      color: #0F4C3A;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .status-icon svg {
      width: 28px;
      height: 28px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111418;
      line-height: 1.3;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
    }
    p.message {
      font-size: 14px;
      color: #4B5563;
      line-height: 1.5;
      margin-bottom: 28px;
    }
    .btn-login {
      display: block;
      width: 100%;
      padding: 13px 20px;
      background: #0F4C3A;
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      transition: background 0.15s ease, transform 0.1s ease;
      box-shadow: 0 1px 2px rgba(15, 76, 58, 0.15);
      border: none;
      cursor: pointer;
    }
    .btn-login:hover {
      background: #0C3D2E;
      transform: translateY(-1px);
    }
    .countdown-text {
      font-size: 12px;
      color: #8A9099;
      margin-top: 14px;
    }
    .security-badge {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #F3F4F6;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11px;
      color: #6B7280;
    }
    .security-badge svg {
      width: 14px;
      height: 14px;
      color: #166534;
    }
  </style>
</head>
<body>
  <div class="container">
    <div style="margin-bottom: 16px; text-align: center;">
      <img src="/brand/logo.png" alt="${brandName}" style="height: 54px; max-width: 220px; object-fit: contain; margin: 0 auto 8px; display: block;" />
      <span style="font-size: 16px; font-weight: 700; color: #111418; display: block;">${brandName}</span>
    </div>

    <div class="status-icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </div>

    <h1>Securely Signed Out</h1>
    <p class="message">
      Your session with <strong>${brandName}</strong> has ended safely. Your financial data and active contracts remain encrypted and protected.
    </p>

    <a href="/login" class="btn-login" id="loginBtn">Sign In Again</a>
    <p class="countdown-text">Redirecting to sign in within <span id="countdown" style="font-weight: 600; color: #0F4C3A;">4</span>s...</p>

    <div class="security-badge">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>256-Bit Bank-Grade Encryption · Safe to close this window</span>
    </div>
  </div>

  <script>
    let timeLeft = 4;
    const cdEl = document.getElementById('countdown');
    const timer = setInterval(() => {
      timeLeft -= 1;
      if (cdEl) cdEl.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(timer);
        window.location.href = '/login';
      }
    }, 1000);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
