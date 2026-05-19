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
    type: 'email' | 'free_session';
  };

  const { parentName, parentEmail, kidName, type } = body;

  if (!parentName || !parentEmail || !kidName || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'noreply@infinitehitting.com';

  if (!resendKey) {
    console.warn('[send-reengagement] RESEND_API_KEY not configured — skipping email delivery');
    return NextResponse.json({ skipped: true });
  }

  const isOffer = type === 'free_session';

  const subject = isOffer
    ? `A free comeback session for ${kidName} — we miss you at Infinite Hitting!`
    : `We miss ${kidName} at Infinite Hitting — let's get back on track`;

  const html = isOffer
    ? `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2D2B2A">
        <div style="background:#2D2B2A;padding:24px;text-align:center">
          <span style="color:#F1E5AD;font-size:20px;font-weight:700">&#9971; Infinite Hitting</span>
        </div>
        <div style="padding:32px">
          <p>Hi ${parentName},</p>
          <p>We've noticed it's been a little while since ${kidName} was last in the cages, and we want to make it easy to come back.</p>
          <p><strong>We'd love to offer ${kidName} a free comeback session</strong> — no strings attached. Just our way of saying we're in your corner and ready to pick up right where you left off.</p>
          <p>Reply to this email or give us a call to schedule. We'll take care of the rest.</p>
          <p>Looking forward to seeing ${kidName} back on the field soon.</p>
          <p>— The Infinite Hitting Coaching Team</p>
        </div>
        <div style="background:#F6F4F1;padding:16px;text-align:center;font-size:12px;color:#888">
          Infinite Hitting Performance &middot; You're receiving this because you're a member.
        </div>
      </div>
    `
    : `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2D2B2A">
        <div style="background:#2D2B2A;padding:24px;text-align:center">
          <span style="color:#F1E5AD;font-size:20px;font-weight:700">&#9971; Infinite Hitting</span>
        </div>
        <div style="padding:32px">
          <p>Hi ${parentName},</p>
          <p>We've been thinking about ${kidName} and wanted to reach out. It's been a while since their last session, and we don't want to lose the momentum they've been building.</p>
          <p>Consistent reps are what separate good hitters from great ones — and ${kidName} has been showing real progress. Let's keep that going.</p>
          <p>Reply here, or book directly through the Ballpark app to get ${kidName} back in the cages.</p>
          <p>We're here whenever you're ready.</p>
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
