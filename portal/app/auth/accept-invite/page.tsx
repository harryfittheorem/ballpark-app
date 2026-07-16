'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { Loader2 } from 'lucide-react';

export default function AcceptInvitePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handle() {
      // createBrowserClient is cookie-based. When a cookie session already exists
      // it reads that for INITIAL_SESSION and then skips URL hash processing entirely.
      // So we parse the hash fragment ourselves and call setSession() explicitly —
      // this works regardless of any pre-existing session.
      const hash = window.location.hash.slice(1); // strip leading '#'
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        setError('No tokens found in this invite link. Please request a new invite.');
        return;
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError || !data.session) {
        setError(
          sessionError?.message ??
          'Could not establish your session. The invite link may have expired — please request a new invite.',
        );
        return;
      }

      const role = data.session.user.user_metadata?.app_role as string | undefined;
      if (role === 'owner') router.replace('/owner');
      else if (role === 'admin') router.replace('/admin');
      else if (role === 'coach') router.replace('/coach');
      else if (role === 'super_admin') router.replace('/hq');
      else router.replace('/login');
    }

    handle();
  }, [router]);

  if (error) {
    return (
      <div style={{
        minHeight: '100vh', background: brand.darkest,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          background: brand.surface, borderRadius: 16, padding: 40,
          maxWidth: 440, width: '100%', textAlign: 'center',
          border: `1px solid ${brand.border}`,
        }}>
          <p style={{ fontFamily: fonts.body, color: brand.danger, fontSize: 14, margin: '0 0 20px' }}>
            {error}
          </p>
          <a
            href="/login"
            style={{
              display: 'inline-block', padding: '10px 24px', borderRadius: 8,
              background: brand.gold, color: brand.darker,
              fontWeight: 700, fontSize: 13, textDecoration: 'none',
              fontFamily: fonts.display,
            }}
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: brand.darkest,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <Loader2 size={32} color={brand.gold} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ fontFamily: fonts.display, fontSize: 16, color: brand.text, margin: 0 }}>
        Setting up your account…
      </p>
    </div>
  );
}
