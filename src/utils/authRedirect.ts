/**
 * Deep-link redirect URL used for Supabase auth email links.
 *
 * Resolution order:
 *  1. `EXPO_PUBLIC_AUTH_REDIRECT_HOST` (preferred for prod) → returns
 *     `https://{host}/auth/callback`. The matching `app.config.js` registers
 *     this host as an iOS Associated Domain and an Android App Link with
 *     `autoVerify=true`, so tapping the link opens Ballpark when installed
 *     and falls through to the web URL (where you can show a "Get the app"
 *     landing page) when not. Add this URL to Supabase Auth → URL
 *     Configuration → Redirect URLs allow-list.
 *  2. Otherwise, `Linking.createURL('/auth/callback')` →
 *     `ballpark:///auth/callback` in standalone builds, or the appropriate
 *     `exp://…` form in Expo Go. Custom-scheme only — fine for local dev,
 *     no graceful fallback when the app isn't installed.
 */

import * as Linking from 'expo-linking';

const AUTH_REDIRECT_HOST = process.env.EXPO_PUBLIC_AUTH_REDIRECT_HOST;

export function getEmailRedirectUrl(): string {
  if (AUTH_REDIRECT_HOST) {
    return `https://${AUTH_REDIRECT_HOST}/auth/callback`;
  }
  return Linking.createURL('/auth/callback');
}

/**
 * Returns the PKCE `code` query param from a Supabase auth redirect URL, or
 * null if the URL isn't an auth callback we should handle.
 *
 * Supabase appends `?code=...` (PKCE flow) on success or `?error=...` on
 * failure to whatever `emailRedirectTo` was sent with the signup.
 */
export function parseAuthCallbackCode(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    // Only handle URLs that target our auth callback path so we don't
    // accidentally consume codes from unrelated deep links (e.g. a future
    // marketing link that also has a `?code=` query param).
    const path = parsed.path ?? '';
    const normalized = path.replace(/^\/+/, '');
    if (normalized !== 'auth/callback') return null;
    const code = parsed.queryParams?.code;
    return typeof code === 'string' && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}
