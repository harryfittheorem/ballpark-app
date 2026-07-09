/**
 * Shared helpers for outbound transactional email (Resend) — Deno edge functions.
 *
 * Branded-sender pattern (Option 1): every email is sent from the platform's
 * single verified domain (RESEND_FROM_EMAIL), but the display name is the
 * customer's own business/location, and Reply-To is set to that location's
 * real contact email so replies go straight to the business — not to us.
 */

const PLATFORM_FROM_EMAIL_DEFAULT = 'onboarding@resend.dev';

export function buildEmailSender(opts: {
  businessName?: string | null;
  replyToEmail?: string | null;
}): { from: string; reply_to?: string } {
  const platformEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? PLATFORM_FROM_EMAIL_DEFAULT;
  const name = opts.businessName?.trim();
  const from = name ? `${name} <${platformEmail}>` : platformEmail;
  const replyTo = opts.replyToEmail?.trim();
  return replyTo ? { from, reply_to: replyTo } : { from };
}

export async function sendResendEmail(payload: {
  to: string;
  subject: string;
  text: string;
  html: string;
  from: string;
  reply_to?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return { ok: false, error: 'RESEND_API_KEY not configured' };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { message?: string })?.message ?? `Resend API error ${res.status}`;
    console.error(`[email] Resend send failed (${res.status}) to=${payload.to} subject="${payload.subject}": ${msg}`);
    return { ok: false, error: msg };
  }

  return { ok: true };
}
