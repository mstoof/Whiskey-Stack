import "server-only";

/**
 * Optional transactional email via Resend.
 *
 * This is a *graceful* layer, exactly like Gemini in lib/gemini.ts. If
 * RESEND_API_KEY (and a verified EMAIL_FROM sender) are not set, price watch
 * still works fully in-app; we just don't send mail. Nothing here throws into
 * the cron loop: send failures are logged and reported as `false`.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** True when both an API key and a from-address are configured. */
export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface PriceDropEmail {
  to: string;
  bottleName: string;
  priceEur: number;
  targetEur: number;
  retailer?: string | null;
  url?: string | null;
}

/**
 * Notify a user that a watched bottle dropped to or below their target price.
 * Returns true only if the mail was actually accepted by Resend.
 */
export async function sendPriceDropEmail(msg: PriceDropEmail): Promise<boolean> {
  if (!isEmailEnabled()) return false;

  const price = `€${msg.priceEur.toFixed(2)}`;
  const target = `€${msg.targetEur.toFixed(2)}`;
  const at = msg.retailer ? ` at ${msg.retailer}` : "";
  const link = msg.url
    ? `<p><a href="${msg.url}">View it${at}</a></p>`
    : "";

  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#2b2018">
      <h2 style="margin:0 0 8px">🥃 Price drop: ${escapeHtml(msg.bottleName)}</h2>
      <p><strong>${price}</strong>${escapeHtml(at)}: at or below your target of ${target}.</p>
      ${link}
      <p style="color:#8a7a68;font-size:13px;margin-top:16px">
        This price is an AI estimate based on web search. Please check the price on the
        retailer's own site before buying. Please drink responsibly.
      </p>
    </div>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: msg.to,
        subject: `🥃 ${msg.bottleName} dropped to ${price}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error("resend email failed:", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.error("resend email error:", err);
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
