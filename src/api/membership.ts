import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/utils/error';

// membership_plans and membership_upgrade_requests are not yet in the generated
// database.ts types — access them via the un-typed SupabaseClient cast until
// the next post-merge type regen.
const sb = supabase as unknown as SupabaseClient;

export type MembershipRow = {
  id: string;
  plan_name: string;
  plan_type: 'eft' | 'otc';
  status: 'active' | 'paused' | 'cancelled' | 'payment_overdue';
  amount_cents: number;
  billing_anchor_day: number | null;
  stripe_subscription_id: string | null;
  pause_start: string | null;
  pause_end: string | null;
  contract_url: string | null;
  payment_failed_at: string | null;
};

export type MembershipPlan = {
  id: string;
  name: string;
  plan_type: string;
  amount_cents: number;
  description: string | null;
  sort_order: number;
};

export async function fetchActiveMembership(familyId: string): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, plan_name, plan_type, status, amount_cents, billing_anchor_day, stripe_subscription_id, pause_start, pause_end, contract_url, payment_failed_at')
    .eq('family_id', familyId)
    .in('status', ['active', 'paused', 'payment_overdue'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(errorMessage(error));
  return data as MembershipRow | null;
}

export async function fetchUpgradePlans(
  tenantId: string,
  currentAmountCents: number,
): Promise<MembershipPlan[]> {
  const { data, error } = await sb
    .from('membership_plans')
    .select('id, name, plan_type, amount_cents, description, sort_order')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .gt('amount_cents', currentAmountCents)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as MembershipPlan[];
}

export async function requestUpgrade(
  membershipId: string,
  requestedPlanId: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');

  const res = await fetch(`${supabaseUrl}/functions/v1/request-membership-upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ membership_id: membershipId, requested_plan_id: requestedPlanId }),
  });

  const body = await res.json() as { ok?: boolean; error?: { message?: string; code?: string } };
  if (!res.ok || !body.ok) {
    const msg = typeof body.error === 'object'
      ? body.error?.message ?? `Error ${res.status}`
      : String(body.error ?? `Error ${res.status}`);
    throw new Error(msg);
  }
}

export async function pauseMembership(membershipId: string, pauseEnd: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');

  const res = await fetch(`${supabaseUrl}/functions/v1/pause-membership`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ membership_id: membershipId, pause_end: pauseEnd }),
  });

  const body = await res.json() as { ok?: boolean; error?: { message?: string; code?: string } };
  if (!res.ok || !body.ok) {
    const msg = typeof body.error === 'object'
      ? body.error?.message ?? `Error ${res.status}`
      : String(body.error ?? `Error ${res.status}`);
    throw new Error(msg);
  }
}

export async function resumeMembership(membershipId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');

  const res = await fetch(`${supabaseUrl}/functions/v1/resume-membership`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ membership_id: membershipId }),
  });

  const body = await res.json() as { ok?: boolean; error?: { message?: string; code?: string } };
  if (!res.ok || !body.ok) {
    const msg = typeof body.error === 'object'
      ? body.error?.message ?? `Error ${res.status}`
      : String(body.error ?? `Error ${res.status}`);
    throw new Error(msg);
  }
}
