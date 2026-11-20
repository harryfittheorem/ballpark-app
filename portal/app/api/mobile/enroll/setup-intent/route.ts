import { type NextRequest, NextResponse } from 'next/server';
import { POST as setupIntent } from '@/app/api/owner/enroll/setup-intent/route';
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
  if (!body || Object.keys(body).some(key => key !== 'membership_id')) return enrollmentError(422, 'Only membership_id is supported');
  const context = await membershipRequest(staff, body.membership_id);
  if (!context) return enrollmentError(404, 'Enrollment not found');
  const { journal } = context;
  const token = await lockEnrollment(staff, journal.id);
  if (!token) return enrollmentError(409, 'Enrollment is processing. Please retry shortly.');
  try {
    // Re-read after locking so a concurrent first request cannot be missed.
    const latest = await membershipRequest(staff, body.membership_id);
    if (latest?.journal.intent) {
      const intent = latest.journal.intent as {
        client_secret: string; intent_type: 'setup' | 'payment'; connected_account_id: string;
      };
      if (latest.journal.completed) return NextResponse.json({ ...intent, payment_confirmed: true });
      // Native PaymentSheet callbacks can be lost on app termination. Ask Stripe
      // before presenting a saved intent again, rather than collecting twice.
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) return enrollmentError(503, 'Stripe is not configured');
      const billingIntent = latest.journal.billing_intent as typeof intent | null;
      const checkedIntent = billingIntent ?? intent;
      const intentId = checkedIntent.client_secret.split('_secret_')[0];
      const result = await fetch(
        `https://api.stripe.com/v1/${checkedIntent.intent_type === 'setup' ? 'setup_intents' : 'payment_intents'}/${encodeURIComponent(intentId)}`,
        { headers: { Authorization: `Bearer ${key}`, 'Stripe-Account': checkedIntent.connected_account_id, 'Stripe-Version': '2024-06-20' } },
      );
      const current = await result.json();
      if (!result.ok) return enrollmentError(502, 'Could not verify payment status. Please retry.');
      if (current.status === 'canceled') return enrollmentError(422, 'This payment was canceled. Contact an administrator to recover this enrollment.');
      return NextResponse.json({
        ...intent, payment_confirmed: current.status === 'succeeded',
        payment_status: billingIntent ? undefined : current.status,
        ...(billingIntent ? { billing_recovery_intent: { ...billingIntent, payment_status: current.status } } : {}),
      });
    }
    const response = await setupIntent(enrollmentRequest(req, { membership_id: body.membership_id }));
    if (!response.ok) return response;
    const intent = await response.json();
    const { data: saved, error } = await staff.service.from('staff_enrollment_requests')
      .update({ intent }).eq('id', journal.id).eq('operation_lock', token).select('id').maybeSingle();
    if (error || !saved) return enrollmentError(500, 'Payment setup could not be saved. Please retry.');
    return NextResponse.json(intent);
  } finally {
    await unlockEnrollment(staff, journal.id, token);
  }
}
