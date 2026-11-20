import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recovery proof authorizes only this new parent's password change. No admin
 * key or ambient staff/browser session is involved; email scanners' GETs do not
 * consume the token. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.token_hash !== 'string' || !/^[a-f0-9]{32,128}$/i.test(body.token_hash) ||
      typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return NextResponse.json({ error: 'Use the email link and a password of 8–128 characters.' }, { status: 422 });
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: body.token_hash, type: 'recovery' });
  if (error || !data.user) return NextResponse.json({ error: 'This password link is invalid or expired. Ask staff for a new link.' }, { status: 422 });
  const { error: updateError } = await supabase.auth.updateUser({ password: body.password });
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 422 });
  await supabase.auth.signOut({ scope: 'local' });
  return NextResponse.json({ ok: true });
}
