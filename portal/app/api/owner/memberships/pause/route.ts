import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireOwnerContext } from '@/lib/ownerAccess';

type PauseBody = {
  membershipId: string;
  pauseStartDate: string;
  expectedResumeDate?: string;
  reason?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { tenantId, user } = await requireOwnerContext();
    const userId = user.id;
    const body = await req.json() as PauseBody;
    const { membershipId, pauseStartDate, expectedResumeDate, reason } = body;

    if (!membershipId || !pauseStartDate) {
      return NextResponse.json({ error: 'membershipId and pauseStartDate required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );

    const { data: mem, error: memErr } = await supabase
      .from('memberships')
      .select('id, tenant_id')
      .eq('id', membershipId)
      .eq('tenant_id', tenantId)
      .single();

    if (memErr || !mem) return NextResponse.json({ error: 'Membership not found' }, { status: 404 });

    const { error } = await supabase
      .from('memberships')
      .update({
        status: 'paused',
        pause_start: pauseStartDate,
        pause_end: expectedResumeDate ?? null,
        paused_at: new Date().toISOString(),
      })
      .eq('id', membershipId)
      .eq('tenant_id', tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Soft-fail: record in membership_admin_events if table exists
    await supabase.from('membership_admin_events').insert({
      membership_id: membershipId,
      tenant_id: tenantId,
      event_type: 'pause',
      effective_date: pauseStartDate,
      expected_resume_date: expectedResumeDate ?? null,
      reason: reason ?? null,
      created_by: userId,
    }).then(null, () => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
