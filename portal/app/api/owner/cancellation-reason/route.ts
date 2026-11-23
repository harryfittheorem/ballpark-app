import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { requireOwnerContext } from '@/lib/ownerAccess';
import { CANCELLATION_REASONS } from '@/lib/supabase/ownerQueries';

export async function POST(req: NextRequest) {
  try {
    await requireOwnerContext();
    const { membershipId, reason, competitorName } = await req.json() as { membershipId: string; reason: string | null; competitorName?: string | null };

    if (!membershipId) {
      return NextResponse.json({ error: 'Missing membershipId' }, { status: 400 });
    }
    if (reason !== null && !CANCELLATION_REASONS.includes(reason as typeof CANCELLATION_REASONS[number])) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }
    if (competitorName != null && competitorName.length > 120) {
      return NextResponse.json({ error: 'Competitor name too long' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const patch: Record<string, unknown> = { cancellation_reason: reason };
    if (reason === 'Competitor') {
      patch.competitor_name = competitorName?.trim() || null;
    } else {
      patch.competitor_name = null;
    }

    const { error } = await supabase
      .from('memberships')
      .update(patch)
      .eq('id', membershipId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
