import { supabase } from '@/lib/supabase';

export type EnrollmentOptions = {
  plans: { id: string; name: string; plan_type: 'eft' | 'otc'; amount_cents: number; description: string | null }[];
  locations: { id: string; name: string; stripe_onboarding_status: string | null }[];
  waiver: { id: string; version: number; effective_date: string; body_text: string } | null;
  stripe_publishable_key: string;
};
export type EnrollmentInput = {
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone?: string;
  kid_first_name: string;
  kid_last_name?: string;
  age_group?: string;
  plan_id: string;
  location_id: string;
  waiver_id: string;
  signature_image_data: string;
};
export type EnrollmentResult = { ok: true; family_id: string; kid_id: string; membership_id: string };
export type EnrollmentIntent = {
  client_secret: string;
  intent_type: 'setup' | 'payment';
  connected_account_id: string;
  payment_confirmed?: boolean;
  payment_status?: string;
  // A SetupIntent saved a card, but the first invoice still needs payment.
  billing_recovery_intent?: EnrollmentIntent;
};
export class EnrollmentApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly recoveryIntent?: EnrollmentIntent) {
    super(message);
    this.name = 'EnrollmentApiError';
  }
}

function enrollmentClaims(accessToken?: string): Record<string, unknown> | null {
  try {
    const segment = (accessToken ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(globalThis.atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '=')));
    return payload;
  } catch { return null; }
}

/** Raw role, not the broader admin presentation alias (which includes HQ). */
export function hasStaffEnrollmentRole(accessToken?: string): boolean {
  const claims = enrollmentClaims(accessToken);
  return claims?.app_role === 'owner' || claims?.app_role === 'admin';
}

/** Enrollment itself still requires both the signed role and tenant scope. */
export function canEnrollStaff(accessToken?: string): boolean {
  return hasStaffEnrollmentRole(accessToken) && !!enrollmentClaims(accessToken)?.tenant_id;
}

/** Refresh saved claims without signing out or collecting the staff password. */
export async function refreshStaffEnrollmentAccess(): Promise<void> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw new Error('Could not refresh staff access. Check your connection and try again.');
  if (!data.session) throw new Error('Your session has expired. Sign in again to continue.');
  if (!hasStaffEnrollmentRole(data.session.access_token)) {
    throw new Error('Enrollment requires a location owner or tenant admin account. HQ-only admins and coaches cannot enroll families.');
  }
  if (!canEnrollStaff(data.session.access_token)) {
    throw new Error('Your owner/admin login is missing business access. Ask an administrator to check its business assignment.');
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !canEnrollStaff(session.access_token)) throw new Error('Owner or admin access is required.');
  const base = process.env.EXPO_PUBLIC_PORTAL_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Staff enrollment needs EXPO_PUBLIC_PORTAL_URL configured.');
  const response = await fetch(`${base}/api/mobile/enroll${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new EnrollmentApiError(
    data?.error ?? `Enrollment request failed (${response.status}). Please retry.`,
    response.status, data?.recovery_intent,
  );
  return data as T;
}

export const getEnrollmentOptions = () => request<EnrollmentOptions>('');
// Reuse the same requestId on every retry, including after a lost response.
export const createStaffEnrollment = (input: EnrollmentInput, requestId: string) =>
  request<EnrollmentResult>('', { ...input, request_id: requestId });
export const createEnrollmentIntent = (membershipId: string) =>
  request<EnrollmentIntent>('/setup-intent', { membership_id: membershipId });
export const completeStaffEnrollment = (result: EnrollmentResult, intent: EnrollmentIntent) =>
  request<{ ok: true; activated: true }>('/attach-payment', {
    family_id: result.family_id,
    membership_id: result.membership_id,
    stripe_intent_id: intent.client_secret.split('_secret_')[0],
  });
