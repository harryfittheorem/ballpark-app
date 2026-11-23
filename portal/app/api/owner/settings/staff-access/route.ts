import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { requireOwnerContext } from '@/lib/ownerAccess';

const VALID_KEYS = ['schedule', 'checkin', 'families', 'redemptions', 'playbook'];

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requireOwnerContext();
    const body = await req.json() as { instructor?: string[]; staff?: string[] };

    const sanitize = (arr: unknown) =>
      Array.isArray(arr) ? (arr as string[]).filter(k => VALID_KEYS.includes(k)) : [];

    const config = {
      instructor: sanitize(body.instructor),
      staff: sanitize(body.staff),
    };

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('tenants')
      .update({ staff_access_config: config })
      .eq('id', tenantId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
}
