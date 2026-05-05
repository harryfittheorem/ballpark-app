/**
 * Auth context — the single source of truth for the current Supabase session.
 *
 * - `loading` is true during the initial getSession() call so the root
 *   navigator can render a splash instead of flashing the auth stack.
 * - Subscribes to onAuthStateChange so sign-in/out updates propagate.
 * - Exposes `appRole` decoded from the JWT's custom claim (set by the
 *   Custom Access Token Hook). Missing/unknown values fall back to
 *   `'parent'` so existing parent users without the claim keep working.
 */

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type AppRole = 'coach' | 'parent';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  appRole: AppRole | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Decode the payload of a JWT without verifying its signature. We only need
 * to read claims that Supabase already verified server-side, so a plain
 * base64url decode is sufficient. Returns null on any parse failure.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    // `globalThis.atob` is available in Hermes/React Native.
    const json = globalThis.atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readAppRole(session: Session | null): AppRole | null {
  if (!session?.access_token) return null;
  const payload = decodeJwtPayload(session.access_token);
  const claim = payload?.app_role;
  if (claim === 'coach') return 'coach';
  // Treat anything else (missing, 'parent', unknown) as parent so existing
  // users without the claim continue to land in the parent flow.
  return 'parent';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      appRole: readAppRole(session),
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
