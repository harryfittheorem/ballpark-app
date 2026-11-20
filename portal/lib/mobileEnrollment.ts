import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { enrollmentAuth } from '@/lib/enrollmentAuth';
import { readAppRole, readTenantId } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/serviceClient';

export const enrollmentError = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function mobileStaff(req: NextRequest) {
  if (!req.headers.get('authorization')) return enrollmentError(401, 'Staff access token required');
  const { session } = await enrollmentAuth(req);
  if (!session) return enrollmentError(401, 'Unauthorized');
  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return enrollmentError(403, 'Owner or admin access required');
  const tenantId = readTenantId(session);
  if (!tenantId) return enrollmentError(403, 'A tenant-scoped staff account is required');
  return { service: createServiceClient(), tenantId, userId: session.user.id };
}
export type MobileStaff = Exclude<Awaited<ReturnType<typeof mobileStaff>>, NextResponse>;

// PostgreSQL UUID columns also contain seeded IDs with version/variant zero.
// Validate canonical syntax, not generation version; tenant ownership and
// active-plan/location/waiver checks remain authoritative in the enrollment API.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);

export function normalizeEnrollment(body: Record<string, unknown>) {
  const keys = [
    'parent_first_name', 'parent_last_name', 'parent_email', 'parent_phone',
    'kid_first_name', 'kid_last_name', 'age_group', 'plan_id', 'location_id',
    'waiver_id', 'signature_image_data', 'request_id',
  ];
  if (Object.keys(body).some(key => !keys.includes(key))) throw new Error('Unsupported enrollment option');
  const clean: Record<string, string> = {};
  for (const key of keys) {
    const value = body[key];
    if (value !== undefined && typeof value !== 'string') throw new Error(`Invalid ${key}`);
    clean[key] = typeof value === 'string' ? value.trim() : '';
  }
  clean.parent_email = clean.parent_email.toLowerCase();
  for (const field of ['plan_id', 'location_id', 'waiver_id', 'request_id']) {
    if (!isUuid(clean[field])) throw new Error(`Invalid ${field}`);
  }
  for (const field of ['parent_first_name', 'parent_last_name', 'kid_first_name']) {
    if (!clean[field] || clean[field].length > 100) throw new Error(`${field} is required (maximum 100 characters)`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.parent_email) || clean.parent_email.length > 254) {
    throw new Error('Enter a valid parent email');
  }
  if (clean.parent_phone.length > 40 || clean.kid_last_name.length > 100) throw new Error('Contact details are too long');
  if (clean.age_group && !['8U', '10U', '12U', '14U', 'HS', 'College'].includes(clean.age_group)) {
    throw new Error('Invalid age group');
  }
  const signature = clean.signature_image_data;
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(signature) || signature.length > 1_500_000) {
    throw new Error('A valid PNG signature is required (maximum 1 MB)');
  }
  const bytes = Buffer.from(signature.split(',')[1], 'base64');
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.length < 100) {
    throw new Error('Invalid PNG signature');
  }
  return clean;
}

export const enrollmentHash = (body: Record<string, string>) =>
  createHash('sha256').update(JSON.stringify(body)).digest('hex');

export function enrollmentRequest(req: NextRequest, body: unknown) {
  return new NextRequest(req.url, {
    method: 'POST',
    headers: { Authorization: req.headers.get('authorization')!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function findEnrollment(staff: MobileStaff, requestId: string) {
  const { data, error } = await staff.service.from('memberships')
    .select('id, family_id, kid_id')
    .eq('tenant_id', staff.tenantId)
    .eq('staff_enrollment_request_id', requestId).maybeSingle();
  if (error) throw new Error('Could not read enrollment. Please retry.');
  return data ? { ok: true, membership_id: data.id, family_id: data.family_id, kid_id: data.kid_id } : null;
}

// An atomic conditional update serializes each request's create/payment steps.
// Expiry allows recovery when the server process dies; Stripe writes also use
// stable idempotency keys, so expiry never authorizes an additional payment.
export async function lockEnrollment(staff: MobileStaff, id: string) {
  const token = randomUUID();
  const { data, error } = await staff.service.from('staff_enrollment_requests')
    .update({ operation_lock: token, locked_until: new Date(Date.now() + 180_000).toISOString() })
    .eq('id', id).eq('tenant_id', staff.tenantId).eq('staff_user_id', staff.userId)
    .or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`)
    .select('id').maybeSingle();
  if (error) throw new Error('Could not lock enrollment. Please retry.');
  return data ? token : null;
}
export async function unlockEnrollment(staff: MobileStaff, id: string, token: string) {
  const { error } = await staff.service.from('staff_enrollment_requests')
    .update({ operation_lock: null, locked_until: null }).eq('id', id).eq('operation_lock', token);
  if (error) console.error('[mobile-enroll] unlock failed', error.code);
}

/** Only enrollments created by this staff user through this flow are accepted. */
export async function membershipRequest(staff: MobileStaff, membershipId: unknown) {
  if (!isUuid(membershipId)) return null;
  const { data: membership, error } = await staff.service.from('memberships')
    .select('id, family_id, staff_enrollment_request_id, stripe_subscription_id, status, plan_type')
    .eq('id', membershipId).eq('tenant_id', staff.tenantId).maybeSingle();
  if (error) throw new Error('Could not load membership');
  if (!membership?.staff_enrollment_request_id) return null;
  const { data: journal, error: journalError } = await staff.service.from('staff_enrollment_requests')
    .select('id, intent, billing_intent, completed').eq('id', membership.staff_enrollment_request_id)
    .eq('tenant_id', staff.tenantId).eq('staff_user_id', staff.userId).maybeSingle();
  if (journalError) throw new Error('Could not load enrollment');
  return journal ? { membership, journal } : null;
}
