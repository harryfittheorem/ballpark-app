/**
 * POST /api/hq/invite/[id]/revoke
 *
 * Revoke a pending HQ Admin invite. Super-admin only.
 * Writes an audit log entry.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';
import { getClientIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail(401, 'Unauthenticated');

  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') return fail(403, 'Forbidden');

  const serviceClient = createServiceClient();

  // DB-level verification.
  const { data: saRow } = await serviceClient
    .from('super_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!saRow) return fail(403, 'Forbidden — no super_admin record found');

  // Fetch the invite to get email for the audit log.
  const { data: invite } = await serviceClient
    .from('hq_invites')
    .select('id, email, status')
    .eq('id', id)
    .maybeSingle();

  if (!invite) return fail(404, 'Invite not found');
  if (invite.status !== 'pending') return fail(409, `Invite is already ${invite.status}`);

  const { error: revokeError } = await serviceClient
    .from('hq_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('status', 'pending');

  if (revokeError) return fail(500, `Failed to revoke invite: ${revokeError.message}`);

  const ip = getClientIp(req);
  await serviceClient
    .from('hq_audit_log')
    .insert({
      actor_user_id: user.id,
      action: 'invite_revoked',
      target_email: invite.email,
      ip,
      metadata: { invite_id: id },
    })
    .then(undefined, (e: unknown) =>
      console.error('[hq/invite/revoke] audit log failed:', e),
    );

  return NextResponse.json({ ok: true });
}
