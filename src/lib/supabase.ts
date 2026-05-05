/**
 * Supabase client for Ballpark.
 *
 * - Reads URL + anon key from EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.
 * - Persists auth session in expo-secure-store (encrypted on-device).
 * - Disables URL-based session detection (we don't use OAuth deep links yet).
 */

import 'react-native-url-polyfill/auto';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly — silent fallbacks here would mask a missing-secrets bug.
  throw new Error(
    'Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Replit Secrets.',
  );
}

/**
 * SecureStore-backed storage adapter for Supabase auth.
 *
 * SecureStore is unavailable on web; fall back to localStorage there so the
 * Expo web preview still works for development.
 */
const secureStorage: SupportedStorage = {
  getItem: (key) => {
    if (Platform.OS === 'web') {
      return Promise.resolve(
        typeof window !== 'undefined' ? window.localStorage.getItem(key) : null,
      );
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
