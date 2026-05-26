/**
 * Root navigator — picks between flows based on auth + role + family state:
 *   1. Loading splash (initial session check, family fetch)
 *   2. Auth stack (signed-out)
 *   3. CoachTabs (signed-in coach)
 *   4. Main tabs (signed-in parent — Home tab shows a friendly empty state
 *      with an "Add your kid" CTA when no kid has been added yet, instead
 *      of trapping the parent in a forced full-screen AddKid prompt).
 *
 * Mounts at the NavigationContainer level. AuthProvider must wrap this.
 */

import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useWaiverGate } from '@/hooks/useWaiver';
import WaiverScreen from '@/screens/Auth/WaiverScreen';
import { colors } from '@/theme';
import type { MainTabParamList } from './types';

import AuthNavigator from './AuthNavigator';
import CoachTabNavigator from './CoachTabNavigator';
import MainTabNavigator from './MainTabNavigator';

// ── Deep-link routing ─────────────────────────────────────────────────────────
// Maps inbound URLs (custom scheme + HTTPS universal links) to screens.
//
// Supported deep links:
//   ballpark://me/payment-method                      → Me tab → PaymentMethod screen
//   ballpark://me/waitlist-claim/:id                  → Me tab → WaitlistClaim screen
//   ballpark://work/?initialSubTab=messages           → Work tab → WorkHome (Messages sub-tab, fallback)
//   ballpark://work/thread/:kidId/:coachUserId        → Work tab → MessageThread
//   ballpark://work/assignment/:assignmentId          → Work tab → AssignmentDetail
//   ballpark://auth/callback                          → Auth callback (handled by Supabase PKCE)
//
// The `ballpark` scheme is registered in app.json.
// HTTPS universal links (when EXPO_PUBLIC_AUTH_REDIRECT_HOST is set) use the
// same path structure under https://{host}/.
const linking: LinkingOptions<MainTabParamList> = {
  prefixes: [
    'ballpark://',
    ...(process.env.EXPO_PUBLIC_AUTH_REDIRECT_HOST
      ? [`https://${process.env.EXPO_PUBLIC_AUTH_REDIRECT_HOST}/`]
      : []),
  ],
  config: {
    screens: {
      Me: {
        path: 'me',
        screens: {
          MeHome: '',
          PaymentMethod: 'payment-method',
          WaitlistClaim: 'waitlist-claim/:waitlistId',
        },
      },
      Work: {
        path: 'work',
        screens: {
          WorkHome: '',
          AssignmentDetail: 'assignment/:assignmentId',
          MessageThread: 'thread/:kidId/:coachUserId',
        },
      },
    },
  },
};

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}

function Inner() {
  const { session, loading: authLoading, appRole } = useAuth();

  // Waiver gate — only applies to parents (coaches don't sign waivers).
  // useWaiverGate is a no-op when there's no session (queries are disabled).
  const { loading: waiverLoading, needsWaiver, activeWaiver } = useWaiverGate();

  if (authLoading) return <Splash />;
  if (!session) return <AuthNavigator />;

  // Coaches don't have a family record — `useFamily` is only mounted under
  // MainTabNavigator (parent surface), so coaches never trigger that fetch.
  if (appRole === 'coach') return <CoachTabNavigator />;

  // While checking the waiver status, show the splash so there's no
  // unprotected flash of the main tabs.
  if (waiverLoading) return <Splash />;

  // Mount MainTabNavigator regardless so navigation state initialises. The
  // WaiverScreen is a full-screen Modal that sits on top and blocks until
  // the parent taps "I Agree" and the query cache is invalidated.
  return (
    <>
      <MainTabNavigator />
      {needsWaiver && activeWaiver ? (
        <WaiverScreen waiver={activeWaiver} />
      ) : null}
    </>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer
      linking={linking}
      theme={{
        dark: true,
        colors: {
          primary: colors.gold,
          background: colors.darkest,
          card: colors.darker,
          text: colors.textOnDark,
          border: colors.border,
          notification: colors.gold,
        },
        fonts: {
          regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
          medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
          bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
          heavy: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' },
        },
      }}
    >
      <Inner />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.darkest },
});
