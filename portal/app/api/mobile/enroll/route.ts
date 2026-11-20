import { type NextRequest, NextResponse } from 'next/server';
import { POST as enroll } from '@/app/api/owner/enroll/route';
import {
  mobileStaff, normalizeEnrollment, enrollmentHash, enrollmentRequest,
  findEnrollment, lockEnrollment, unlockEnrollment, enrollmentError,
} from '@/lib/mobileEnrollment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const staff = await mobileStaff(req);
  if (staff instanceof NextResponse) return staff;
  const [{ data: plans, error: planError }, { data: locations, error: locationError }, { data: waiver, error: waiverError }] = await Promise.all([
    staff.service.from('membership_plans')
      .select('id, name, plan_type, amount_cents, description')
      .eq('tenant_id', staff.tenantId).eq('is_active', true).order('sort_order'),
    staff.service.from('locations').select('id, name, stripe_onboarding_status')
      .eq('tenant_id', staff.tenantId).order('name'),
    staff.service.from('waivers').select('id, version, effective_date, body_text')
      .eq('tenant_id', staff.tenantId).eq('is_active', true).maybeSingle(),
  ]);
  if (planError || locationError || waiverError) return enrollmentError(500, 'Could not load enrollment options. Please retry.');
  const stripeKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!stripeKey) return enrollmentError(503, 'Enrollment payments are not configured');
  return NextResponse.json({ plans, locations, waiver, stripe_publishable_key: stripeKey }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function POST(req: NextRequest) {
  const staff = await mobileStaff(req);
  if (staff instanceof NextResponse) return staff;
  let body: Record<string, string>;
  try {
    body = normalizeEnrollment(await req.json());
  } catch (error) {
    return enrollmentError(422, error instanceof Error ? error.message : 'Invalid enrollment');
  }
  const id = body.request_id;
  const hash = enrollmentHash(body);
  const { error: insertError } = await staff.service.from('staff_enrollment_requests').insert({
    id, tenant_id: staff.tenantId, staff_user_id: staff.userId, payload_hash: hash,
  });
  if (insertError && insertError.code !== '23505') return enrollmentError(500, 'Could not start enrollment. Please retry.');
  const { data: journal, error: journalError } = await staff.service.from('staff_enrollment_requests')
    .select('payload_hash').eq('id', id).eq('tenant_id', staff.tenantId).eq('staff_user_id', staff.userId).maybeSingle();
  if (journalError) return enrollmentError(500, 'Could not load enrollment. Please retry.');
  if (!journal || journal.payload_hash !== hash) return enrollmentError(409, 'Enrollment request changed. Start a new enrollment request.');
  const token = await lockEnrollment(staff, id);
  if (!token) return enrollmentError(409, 'Enrollment is still processing. Please retry shortly.');
  try {
    const existing = await findEnrollment(staff, id);
    if (existing) return NextResponse.json(existing);
    return await enroll(enrollmentRequest(req, body));
  } catch (error) {
    console.error('[mobile-enroll] create failed', error);
    return enrollmentError(500, 'Could not confirm enrollment. Retry this enrollment; do not start a duplicate.');
  } finally {
    await unlockEnrollment(staff, id, token);
  }
}
