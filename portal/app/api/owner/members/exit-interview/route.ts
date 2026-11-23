import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { requireOwnerContext } from '@/lib/ownerAccess';

export async function POST(req: NextRequest) {
  try {
    const { email: staffEmail } = await requireOwnerContext();
    const { membershipId, field, value } = await req.json() as { membershipId: string; field: 'exit_interview_requested' | 'waiver_authorized'; value: boolean };

    if (!membershipId) return NextResponse.json({ error: 'Missing membershipId' }, { status: 400 });
    if (field !== 'exit_interview_requested' && field !== 'waiver_authorized') {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { [field]: value };
    if (field === 'exit_interview_requested' && value) patch.exit_interview_requested_at = new Date().toISOString();
    if (field === 'waiver_authorized' && value) {
      patch.waiver_authorized_at = new Date().toISOString();
      patch.waiver_authorized_by = staffEmail ?? 'staff';
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('memberships').update(patch).eq('id', membershipId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
