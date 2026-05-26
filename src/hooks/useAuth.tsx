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

import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/lib/supabase";
import { registerForPushNotifications } from "@/services/notifications";
import { parseAuthCallbackCode } from "@/utils/authRedirect";

export type AppRole = "coach" | "parent";

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
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
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
  if (claim === "coach") return "coach";
  // Treat anything else (missing, 'parent', unknown) as parent so existing
  // users without the claim continue to land in the parent flow.
  return "parent";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        void registerForPushNotifications();
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);

        // Register push token after successful auth session
        if (newSession?.user) {
          try {
            const token = await registerForPushNotifications();

            if (token) {
              console.log("[push] token registered", token);

              // TODO:
              // Save token to Supabase once push_tokens column exists.
            }
          } catch (err) {
            console.warn("[push] registration failed", err);
          }
        }
      },
    );

    // Deep-link handler: when the parent taps the Supabase confirmation
    // email, the OS opens the app with `ballpark:///auth/callback?code=...`.
    // We exchange that PKCE code for a session — `onAuthStateChange` then
    // fires SIGNED_IN and the app navigates past the auth stack
    // automatically, no polling required.
    const handleUrl = async (url: string) => {
      const code = parseAuthCallbackCode(url);
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        // Surface to console only; the auth screens stay put and the user
        // can retry from there. Avoids a noisy modal on cold start.
        console.warn("[auth] exchangeCodeForSession failed", error.message);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });
    const linkingSub = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    // Push notification tap routing:
    // Each push kind maps to a ballpark:// deep link that the NavigationContainer
    // linking config resolves to the correct screen.
    //
    //   coach_message       → Work tab, WorkHome initialSubTab=messages
    //                         (payload has only video_id; kidId+coachUserId are
    //                         unavailable so we can't jump to MessageThread directly)
    //   parent_to_coach     → coach-side; no parent route needed
    //   assignment_reviewed → Work tab → AssignmentDetail (has assignment_id)
    //   waitlist_promoted   → Me tab → WaitlistClaim
    const notifSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        > | null;
        if (!data) return;

        if (data.kind === "coach_message") {
          // Prefer direct MessageThread navigation when the payload carries both
          // IDs (payloads from mux-webhook v2+). Fall back to the WorkHome
          // Messages sub-tab for older payloads that omit them.
          if (
            typeof data.kid_id === "string" &&
            typeof data.coach_user_id === "string"
          ) {
            void Linking.openURL(
              `ballpark://work/thread/${data.kid_id}/${data.coach_user_id}`,
            );
          } else {
            void Linking.openURL("ballpark://work/?initialSubTab=messages");
          }
        } else if (
          data.kind === "assignment_reviewed" &&
          typeof data.assignment_id === "string"
        ) {
          void Linking.openURL(
            `ballpark://work/assignment/${data.assignment_id}`,
          );
        } else if (
          data.kind === "waitlist_promoted" &&
          typeof data.waitlist_id === "string"
        ) {
          void Linking.openURL(
            `ballpark://me/waitlist-claim/${data.waitlist_id}`,
          );
        }
      },
    );

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      linkingSub.remove();
      notifSub.remove();
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
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
