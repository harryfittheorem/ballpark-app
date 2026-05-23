import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/utils/error';

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
  paused_at: string | null;
};

export async function fetchActiveMembership(familyId: string): Promise<MembershipRow | null> {
  const { data, error } = await supabase
    .from('memberships')
    .select('id, plan_name, plan_type, status, amount_cents, billing_anchor_day, stripe_subscription_id, pause_start, pause_end, paused_at')
    .eq('family_id', familyId)
    .in('status', ['active', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(errorMessage(error));
  return data as MembershipRow | null;
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
