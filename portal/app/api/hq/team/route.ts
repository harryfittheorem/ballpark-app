import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') return null;
  return user;
}

export async function PATCH(req: Request) {
  const user = await assertSuperAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    userId: string;
    action: 'ban' | 'unban' | 'update_role';
    fromRole?: string;
    role?: string;
  };

  const { userId, action, fromRole, role } = body;
  if (!userId || !action) {
    return NextResponse.json({ error: 'userId and action are required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminHeaders = {
    'Content-Type': 'application/json',
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  if (action === 'ban') {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ ban_duration: '876000h' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { msg?: string };
      return NextResponse.json({ error: err.msg ?? 'Failed to ban user' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'unban') {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ ban_duration: 'none' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { msg?: string };
      return NextResponse.json({ error: err.msg ?? 'Failed to unban user' }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'update_role') {
    if (!role) return NextResponse.json({ error: 'role is required for update_role' }, { status: 400 });

    // Demoting to coach is not supported via this UI — coaches have a full
    // profile-table record that requires proper provisioning via the invite flow.
    if (role === 'coach') {
      return NextResponse.json(
        { error: 'To add a coach, use the Invite flow instead of changing an existing member\'s role.' },
        { status: 400 },
      );
    }

    const service = createServiceClient();

    // Update auth metadata first.
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ user_metadata: { app_role: role } }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { msg?: string };
      return NextResponse.json({ error: err.msg ?? 'Failed to update role' }, { status: 502 });
    }

    // If the member was a coach, deactivate their coaches table row so they
    // no longer appear in getHQTeam as a coach.
    if (fromRole === 'coach') {
      const { error: coachErr } = await service
        .from('coaches')
        .update({ is_active: false })
        .eq('user_id', userId);
      if (coachErr) {
        // Log but don't fail — metadata is already updated; the coaches row
        // is secondary. An admin can manually clean up if needed.
        console.error('[hq/team] Failed to deactivate coaches row:', coachErr.message);
      }
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
