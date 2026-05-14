/**
 * Supabase client that authenticates with the service-role key.
 * Use only in server-side code where you need to bypass RLS
 * (e.g. OAuth callbacks that act on behalf of a user but cannot
 * carry their JWT because no session exists yet).
 *
 * NEVER expose this client to the browser.
 */
import { createClient as _createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return _createClient(url, key, {
    auth: { persistSession: false },
  });
}
