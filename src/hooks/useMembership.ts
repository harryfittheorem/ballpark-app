import { useState, useEffect, useCallback } from 'react';
import { useFamily } from '@/hooks/useFamily';
import {
  fetchActiveMembership,
  pauseMembership,
  resumeMembership,
  requestUpgrade,
  type MembershipRow,
} from '@/api/membership';
import { errorMessage } from '@/utils/error';

export type UseMembershipResult = {
  membership: MembershipRow | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  pause: (pauseEnd: string) => Promise<void>;
  resume: () => Promise<void>;
  upgrade: (planId: string) => Promise<void>;
};

export function useMembership(): UseMembershipResult {
  const { family } = useFamily();
  const [membership, setMembership] = useState<MembershipRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!family?.id) return;
    setLoading(true);
    setError(null);
    try {
      const m = await fetchActiveMembership(family.id);
      setMembership(m);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [family?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pause = useCallback(async (pauseEnd: string) => {
    if (!membership) throw new Error('No active membership');
    await pauseMembership(membership.id, pauseEnd);
    await load();
  }, [membership, load]);

  const resume = useCallback(async () => {
    if (!membership) throw new Error('No membership to resume');
    await resumeMembership(membership.id);
    await load();
  }, [membership, load]);

  const upgrade = useCallback(async (planId: string) => {
    if (!membership) throw new Error('No active membership');
    await requestUpgrade(membership.id, planId);
  }, [membership]);

  return { membership, loading, error, refresh: load, pause, resume, upgrade };
}
