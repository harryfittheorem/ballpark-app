import { type NextRequest, NextResponse } from 'next/server';
import { POST as attachPayment } from '@/app/api/owner/enroll/attach-payment/route';
import {
  mobileStaff, membershipRequest, lockEnrollment, unlockEnrollment,
  enrollmentRequest, enrollmentError,
} from '@/lib/mobileEnrollment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const staff = await mobileStaff(req);
  if (staff instanceof NextResponse) return staff;
  const body = await req.json().catch(() => null);
  if (!body || Object.keys(body).some(key => !['membership_id', 'family_id', 'stripe_intent_id'].includes(key))) {
    return enrollmentError(422, 'Only full-price enrollment payment is supported');
  }
  const context = await membershipRequest(staff, body.membership_id);
  if (!context) return enrollmentError(404, 'Enrollment not found');
  const { membership, journal } = context;
  if (membership.family_id !== body.family_id) return enrollmentError(403, 'Family does not match enrollment');
  const intent = journal.intent as { client_secret?: string } | null;
  if (!intent?.client_secret || intent.client_secret.split('_secret_')[0] !== body.stripe_intent_id) {
    return enrollmentError(422, 'Payment does not match enrollment');
  }
  if (journal.completed) return NextResponse.json({ ok: true, activated: true });
  const token = await lockEnrollment(staff, journal.id);
  if (!token) return enrollmentError(409, 'Enrollment is processing. Please retry shortly.');
  try {
    const latest = await membershipRequest(staff, body.membership_id);
    if (latest?.journal.completed) return NextResponse.json({ ok: true, activated: true });
    const response = await attachPayment(enrollmentRequest(req, body));
    if (!response.ok) {
      if (response.status === 402) {
        const recovery = await response.clone().json() as { recovery_intent?: unknown };
        if (recovery.recovery_intent) {
          const { error } = await staff.service.from('staff_enrollment_requests')
            .update({ billing_intent: recovery.recovery_intent }).eq('id', journal.id).eq('operation_lock', token);
          if (error) return enrollmentError(500, 'Card saved; invoice recovery could not be saved. Retry confirmation.');
        }
      }
      return response;
    }
    const { data: activated, error: activationError } = await staff.service.from('memberships')
      .select('status').eq('id', membership.id).eq('tenant_id', staff.tenantId).maybeSingle();
    if (activationError || activated?.status !== 'active') {
      return enrollmentError(500, 'Payment succeeded but membership activation could not be saved. Retry confirmation, not payment.');
    }
    const { data: saved, error } = await staff.service.from('staff_enrollment_requests')
      .update({ completed: true }).eq('id', journal.id).eq('operation_lock', token).select('id').maybeSingle();
    if (error || !saved) return enrollmentError(500, 'Payment succeeded but confirmation could not be saved. Retry confirmation, not payment.');
    return response;
  } finally {
    await unlockEnrollment(staff, journal.id, token);
  }
}
