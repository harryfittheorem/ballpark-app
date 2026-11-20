import { createClient as createSupabaseClient, type Session } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Enrollment accepts the portal cookie session or the mobile user's access
 * token. Always verify with Auth before trusting custom role/tenant claims.
 * A bad Authorization header must never fall back to ambient cookies.
 */
export async function enrollmentAuth(req: NextRequest) {
  const authorization = req.headers.get('authorization');
  if (authorization !== null) {
    const token = authorization.match(/^Bearer ([^\s]+)$/i)?.[1];
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token ?? ''}` } },
      },
    );
    if (!token) return { supabase: client, session: null };
    const { data, error } = await client.auth.getUser(token);
    return {
      supabase: client,
      session: error || !data.user ? null : {
        access_token: token, user: data.user,
      } as Session,
    };
  }
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { supabase, session: null };
  const { data, error } = await supabase.auth.getUser(session.access_token);
  return { supabase, session: error || !data.user ? null : session };
}

export function isMobileEnrollment(req: NextRequest) {
  return req.nextUrl.pathname.startsWith('/api/mobile/enroll');
}
