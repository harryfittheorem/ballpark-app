import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole } from '@/lib/auth';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    parentName: string;
    parentEmail: string;
    kidName: string;
    planName: string;
    sessionsRemaining?: number | null;
    expiresAtLabel?: string | null;
  };

  const { parentName, parentEmail, kidName, planName, sessionsRemaining, expiresAtLabel } = body;

  if (!parentName || !parentEmail || !kidName || !planName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'noreply@infinitehitting.com';

  if (!resendKey) {
    console.warn('[send-renewal-reminder] RESEND_API_KEY not configured — skipping email delivery');
    return NextResponse.json({ skipped: true });
  }

  const hasExpiry  = !!expiresAtLabel;
  const hasBalance = sessionsRemaining != null;

  const subject = hasExpiry
    ? `${kidName}'s ${planName} expires ${expiresAtLabel} — renew to keep the momentum going`
    : `${kidName} is running low on sessions — time to renew`;

  const detailLine = hasExpiry && hasBalance
    ? `<p><strong>${sessionsRemaining} session${sessionsRemaining !== 1 ? 's' : ''} remaining</strong> and the pack expires on <strong>${expiresAtLabel}</strong>.</p>`
    : hasExpiry
    ? `<p>The pack expires on <strong>${expiresAtLabel}</strong>.</p>`
    : hasBalance
    ? `<p><strong>${sessionsRemaining} session${sessionsRemaining !== 1 ? 's' : ''} remaining</strong> on the ${planName}.</p>`
    : `<p>The ${planName} is running low.</p>`;

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2D2B2A">
      <div style="background:#2D2B2A;padding:24px;text-align:center">
        <span style="color:#F1E5AD;font-size:20px;font-weight:700">&#9971; Infinite Hitting</span>
      </div>
      <div style="padding:32px">
        <p>Hi ${parentName},</p>
        <p>Just a heads-up — ${kidName}'s <strong>${planName}</strong> is coming up for renewal.</p>
        ${detailLine}
        <p>Renewing now keeps ${kidName} on track without any gap in training. Consistent reps are how good hitters become great ones.</p>
        <p>Reply to this email, give us a call, or renew directly through the Ballpark app.</p>
        <p>We're looking forward to keeping ${kidName} in the cages.</p>
        <p>— The Infinite Hitting Coaching Team</p>
      </div>
      <div style="background:#F6F4F1;padding:16px;text-align:center;font-size:12px;color:#888">
        Infinite Hitting Performance &middot; You're receiving this because you're a member.
      </div>
    </div>
  `;

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({ from: resendFrom, to: parentEmail, subject, html }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({})) as { message?: string };
    return NextResponse.json(
      { error: `Email delivery failed: ${err.message ?? sendRes.statusText}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
