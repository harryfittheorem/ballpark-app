/**
 * Auth API helpers.
 *
 * Thin wrappers around supabase.auth that bake in the v0.1 tenant_slug
 * convention: every signup must carry tenant_slug in user_metadata so
 * `public.handle_new_user` can resolve the tenant and provision a family row.
 *
 * Multi-tenant builds (EXPO_PUBLIC_TENANT_SLUG unset) pass tenant_slug at
 * call time via the LocationPickerScreen; single-tenant builds fall back to
 * the baked-in env var.
 */

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { getEmailRedirectUrl } from '@/utils/authRedirect';

const DEFAULT_TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? '';

export type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  /** Override the baked-in tenant slug. Used by LocationPickerScreen. */
  tenantSlug?: string;
  /** The UUID of the location the parent selected. Used by LocationPickerScreen.
   *  When present, `handle_new_user` sets `families.primary_location_id`. */
  locationId?: string;
};

export async function signUpParent(input: SignUpInput) {
  const tenantSlug = input.tenantSlug ?? DEFAULT_TENANT_SLUG;
  if (!tenantSlug) {
    throw new Error('signUpParent: tenantSlug is required (no EXPO_PUBLIC_TENANT_SLUG set and none provided)');
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      // Tells Supabase where to send the parent after they tap the
      // confirmation link. The deep-link handler in `useAuth.tsx` picks up
      // the resulting `?code=...` and exchanges it for a session.
      emailRedirectTo: getEmailRedirectUrl(),
      data: {
        tenant_slug: tenantSlug,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() ?? null,
        ...(input.locationId ? { location_id: input.locationId } : {}),
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Re-send the Supabase signup confirmation email. Uses the same
 * `emailRedirectTo` as `signUpParent` so the deep-link round-trip works
 * identically — the parent taps the new email and lands back in the app
 * with a session.
 */
export async function resendConfirmationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getEmailRedirectUrl() },
  });
  if (error) throw error;
}

export async function signInParent(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  // Drop all cached queries so a subsequent sign-in never sees the
  // previous account's family/kids.
  queryClient.clear();
}
