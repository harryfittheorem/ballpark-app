/**
 * POST /api/owner/members/message
 *
 * Staff action: send a one-off message from the member detail page's
 * "Message" button. Delivered as an email via Resend (mirrors the
 * send-reengagement route's pattern). No in-app messaging thread exists
 * for owner<->family today, so this is a minimal compose-and-send flow.
 *
 * Body: {
 *   parentEmail: string
 *   parentName: string
 *   kidName: string
 *   subject: string
 *   message: string
 * }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clientErr(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return clientErr(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin' && role !== 'super_admin') {
    return clientErr(403, 'Forbidden');
  }

  const body = await req.json().catch(() => ({})) as {
    parentEmail?: string;
    parentName?: string;
    kidName?: string;
    subject?: string;
    message?: string;
  };

  const { parentEmail, parentName, kidName, subject, message } = body;

  if (!parentEmail || !parentName || !subject?.trim() || !message?.trim()) {
    return clientErr(400, 'parentEmail, parentName, subject, and message are required');
  }

  const resendKey = process.env.RESEND_API_KEY;
  const resendFrom = process.env.RESEND_FROM_EMAIL ?? 'noreply@infinitehitting.com';

  if (!resendKey) {
    console.warn('[owner/members/message] RESEND_API_KEY not configured — skipping email delivery');
    return clientErr(500, 'Email is not configured for this environment');
  }

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#2D2B2A">
      <div style="background:#2D2B2A;padding:24px;text-align:center">
        <span style="color:#F1E5AD;font-size:20px;font-weight:700">&#9971; Infinite Hitting</span>
      </div>
      <div style="padding:32px">
        <p>Hi ${parentName},</p>
        <p style="white-space:pre-wrap">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <p>— The ${kidName ? `Infinite Hitting Coaching Team (re: ${kidName})` : 'Infinite Hitting Coaching Team'}</p>
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
    body: JSON.stringify({ from: resendFrom, to: parentEmail, subject: subject.trim(), html }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.json().catch(() => ({})) as { message?: string };
    return clientErr(502, `Email delivery failed: ${err.message ?? sendRes.statusText}`);
  }

  return NextResponse.json({ ok: true });
}
