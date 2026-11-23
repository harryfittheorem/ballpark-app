import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { requireOwnerContext } from '@/lib/ownerAccess';

type TrackingBody = {
  kidId: string;
  type: 'review' | 'referral';
  field: 'asked' | 'left' | 'given';
  value: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { tenantId, userId } = await requireOwnerContext();
    const body = await req.json() as TrackingBody;
    const { kidId, type, field, value } = body;

    if (!kidId || !type || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );

    if (type === 'review') {
      const update: Record<string, unknown> = {
        tenant_id: tenantId,
        kid_id: kidId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
      if (field === 'asked') {
        update.review_asked = value;
        update.review_asked_at = value ? new Date().toISOString() : null;
      } else {
        update.review_left = value;
        update.review_left_at = value ? new Date().toISOString() : null;
      }
      const { error } = await supabase
        .from('kid_review_tracking')
        .upsert(update, { onConflict: 'tenant_id,kid_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const update: Record<string, unknown> = {
        tenant_id: tenantId,
        kid_id: kidId,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
      if (field === 'asked') {
        update.referral_asked = value;
        update.referral_asked_at = value ? new Date().toISOString() : null;
      } else {
        update.referral_given = value;
        update.referral_given_at = value ? new Date().toISOString() : null;
      }
      const { error } = await supabase
        .from('kid_referral_tracking')
        .upsert(update, { onConflict: 'tenant_id,kid_id' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
