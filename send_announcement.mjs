// send_announcement.mjs
// One-time script to email remaining BBMI users via Resend
// Run with: node send_announcement.mjs

import { initializeApp, cert } from "firebase-admin/app";
import { Resend } from "resend";

// --- CONFIG ---
const RESEND_API_KEY = "re_ffdP4yqE_6q9wrGT9ZKdKcADLgooVQm5v"; // regenerate after sending
const FROM_EMAIL = "Andy <andy@bbmisports.com>";
const REPLY_TO = "support@bbmisports.com";
const DELAY_MS = 100;
// --------------

initializeApp({
  credential: cert("./serviceAccountKey.json"),
});

const resend = new Resend(RESEND_API_KEY);

// --- RECIPIENT LIST ---
// Already sent to: willbrantner, andrewbrantner, david.bivens, test@example.com,
// kerryj.danielson, test3@example.com, test2@example.com, nate.blanchard, evwick
const users = [
  { email: "stevearcard83@gmail.com", firstName: null },
  { email: "mountain.jellyfish@gmail.com", firstName: null },
  { email: "tyler.boon@gmail.com", firstName: null },
  { email: "gmasie@hotmail.com", firstName: null },
  { email: "jordanramis@icloud.com", firstName: null },
];
// ----------------------

function buildEmailHtml(firstName) {
  const name = firstName || "there";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Georgia, serif; background: #f5f4f0; margin: 0; padding: 32px 16px; color: #1a1a1a; }
    .card { background: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 8px; padding: 40px 44px; border: 1px solid #e0ddd6; }
    .logo { font-family: 'Helvetica Neue', sans-serif; font-weight: 800; font-size: 20px; letter-spacing: -0.5px; color: #1a1a1a; margin-bottom: 28px; }
    .logo span { color: #c97d10; }
    h2 { font-size: 22px; font-weight: 700; margin: 0 0 16px; line-height: 1.2; }
    p { font-size: 15px; line-height: 1.7; margin: 0 0 16px; color: #333; }
    .section-label { font-family: 'Helvetica Neue', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #c97d10; margin: 28px 0 12px; }
    .sport-block { background: #f9f8f5; border-left: 3px solid #c97d10; border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 8px 0; }
    .sport-block strong { font-size: 14px; font-family: 'Helvetica Neue', sans-serif; font-weight: 700; color: #1a1a1a; }
    .sport-block p { font-size: 13px; color: #666; margin: 4px 0 0; }
    .pricing { background: #fff8ee; border: 1px solid #f0d9a0; border-radius: 6px; padding: 20px 24px; margin: 24px 0; }
    .pricing .headline { font-family: 'Helvetica Neue', sans-serif; font-size: 17px; font-weight: 700; color: #1a1a1a; margin: 0 0 12px; }
    .pricing p { margin: 6px 0; font-size: 14px; font-family: 'Helvetica Neue', sans-serif; color: #444; }
    .pricing p::before { content: "✓ "; color: #c97d10; font-weight: 700; }
    .cta { display: block; background: #c97d10; color: #ffffff !important; text-align: center; padding: 14px 24px; border-radius: 6px; font-family: 'Helvetica Neue', sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; margin: 28px 0 24px; letter-spacing: 0.01em; }
    .closing { font-size: 14px; color: #666; }
    .footer { font-family: 'Helvetica Neue', sans-serif; font-size: 12px; color: #999; border-top: 1px solid #ece9e2; margin-top: 32px; padding-top: 20px; line-height: 1.6; }
    .footer a { color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BBMI <span>Sports</span></div>

    <h2>New sports, new models, new pricing.</h2>

    <p>Hey ${name},</p>

    <p>Quick update on what's new at BBMI Sports.</p>

    <div class="section-label">Two new sports are now live</div>

    <div class="sport-block">
      <strong>⚾ MLB</strong>
      <p>Spread and O/U picks powered by park factor adjustments, pitcher ERA modeling, weather signals (including Wrigley wind direction), and our validated Away Ace tier — 81% ATS in walk-forward testing.</p>
    </div>

    <div class="sport-block">
      <strong>⚾ NCAA Baseball</strong>
      <p>Spread and O/U picks with day-of-week adjusted totals — one of the most overlooked edges in college baseball.</p>
    </div>

    <p style="margin-top: 20px;">Both models went through the same rigorous walk-forward validation process as our basketball and football models. No cherry-picked backtests.</p>

    <div class="section-label">Try it for $10</div>

    <div class="pricing">
      <p class="headline">No commitment. No auto-renewal.</p>
      <p>7 days of full access across all four sports</p>
      <p>Just a flat $10 to see if it's worth it</p>
      <p>Monthly subscription, just $35, available after that if you want to continue</p>
    </div>

    <a href="https://bbmisports.com" class="cta">Get 7 days of picks for $10 →</a>

    <p class="closing">As always, the full track record is live on the site — nothing hidden.</p>

    <p class="closing">— Andy<br>Founder, BBMI Sports</p>

    <div class="footer">
      You're receiving this because you signed up at bbmisports.com or bbmihoops.com.<br>
      <a href="https://bbmisports.com">bbmisports.com</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function buildEmailText(firstName) {
  const name = firstName || "there";
  return `
Hey ${name},

Quick update on what's new at BBMI Sports.

--- Two new sports are now live ---

⚾ MLB
Spread and O/U picks powered by park factor adjustments, pitcher ERA modeling, weather signals (including Wrigley wind direction), and our validated Away Ace tier — 81% ATS in walk-forward testing.

⚾ NCAA Baseball
Spread and O/U picks with day-of-week adjusted totals — one of the most overlooked edges in college baseball.

Both models went through the same rigorous walk-forward validation process as our basketball and football models. No cherry-picked backtests.

--- Try it for $10 — no commitment ---

✓ 7 days of full access across all four sports
✓ No auto-renewal — just a flat $10 to see if it's worth it
✓ Monthly subscription, just $35, available after that if you want to continue

Check out the picks at https://bbmisports.com

As always, the full track record is live on the site — nothing hidden.

— Andy
Founder, BBMI Sports
bbmisports.com

---
You're receiving this because you signed up at bbmisports.com or bbmihoops.com.
  `.trim();
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Sending to ${users.length} recipients...`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        replyTo: REPLY_TO,
        subject: "New sports, new models, new pricing — BBMI update",
        html: buildEmailHtml(user.firstName),
        text: buildEmailText(user.firstName),
      });
      console.log(`✓ Sent to ${user.email}`);
      sent++;
    } catch (err) {
      console.error(`✗ Failed for ${user.email}:`, err.message);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main().catch(console.error);
