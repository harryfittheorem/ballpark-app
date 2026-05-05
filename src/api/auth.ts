/**
 * Auth API helpers.
 *
 * Thin wrappers around supabase.auth that bake in the v0.1 tenant_slug
 * convention: every signup must carry tenant_slug in user_metadata so
 * `public.handle_new_user` can resolve the tenant and provision a family row.
 */

import { supabase } from '@/lib/supabase';

const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting';

export type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export async function signUpParent(input: SignUpInput) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        tenant_slug: TENANT_SLUG,
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
        phone: input.phone?.trim() ?? null,
      },
    },
  });
  if (error) throw error;
  return data;
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
}
