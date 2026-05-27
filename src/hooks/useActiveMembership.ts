/**
 * useActiveMembership — fetches the current kid's active membership.
 *
 * OTC pack holders:    sessions_remaining / sessions_total.
 * EFT limited:        sessions_per_week / weekly_sessions_used / weekly_period_start.
 *                     Derives weeklyRemaining and weeklyTotal for UI consumption.
 * EFT unlimited:      sessions_per_week = null → weeklyRemaining = null (uncapped).
 * No membership:      returns null.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getActiveMembership, type ActiveMembership } from '@/api/memberships';
import { useFamily } from '@/hooks/useFamily';

export const activeMembershipKey = (kidId: string) =>
  ['active_membership', kidId] as const;

/** Returns Monday of the ISO week containing `date` as a YYYY-MM-DD string. */
function currentMondayYmd(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // offset to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export type UseMembershipResult = {
  data: ActiveMembership | null | undefined;
  isLoading: boolean;
  error: Error | null;
  /**
   * EFT limited: credits remaining this week (>= 0).
   * EFT unlimited or OTC: null (no weekly cap).
   */
  weeklyRemaining: number | null;
  /**
   * EFT limited: total credits allowed per week (sessions_per_week).
   * EFT unlimited or OTC: null.
   */
  weeklyTotal: number | null;
};

export function useActiveMembership(): UseMembershipResult {
  const { family, kids } = useFamily();
  const kid = kids[0] ?? null;

  const query = useQuery<ActiveMembership | null, Error>({
    queryKey: activeMembershipKey(kid?.id ?? ''),
    queryFn: () => getActiveMembership(kid!.id, family!.tenant_id),
    enabled: !!kid && !!family,
    staleTime: 30_000,
  });

  const { weeklyRemaining, weeklyTotal } = useMemo(() => {
    const m = query.data;
    if (!m || m.plan_type !== 'eft' || m.sessions_per_week == null) {
      return { weeklyRemaining: null, weeklyTotal: null };
    }

    // If the stored period_start is before the current Monday, the DB cron
    // hasn't run yet — treat weekly_sessions_used as 0 for display purposes.
    const storedMonday = m.weekly_period_start ?? null;
    const currentMonday = currentMondayYmd();
    const weeklyUsed =
      storedMonday && storedMonday >= currentMonday ? m.weekly_sessions_used : 0;

    return {
      weeklyRemaining: Math.max(0, m.sessions_per_week - weeklyUsed),
      weeklyTotal:     m.sessions_per_week,
    };
  }, [query.data]);

  return {
    data:            query.data,
    isLoading:       query.isLoading,
    error:           query.error,
    weeklyRemaining,
    weeklyTotal,
  };
}
