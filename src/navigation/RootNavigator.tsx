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

import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme';

import AuthNavigator from './AuthNavigator';
import CoachTabNavigator from './CoachTabNavigator';
import MainTabNavigator from './MainTabNavigator';

function Splash() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}

function Inner() {
  const { session, loading: authLoading, appRole } = useAuth();

  if (authLoading) return <Splash />;
  if (!session) return <AuthNavigator />;
  // Coaches don't have a family record — `useFamily` is only mounted under
  // MainTabNavigator (parent surface), so coaches never trigger that fetch.
  if (appRole === 'coach') return <CoachTabNavigator />;
  return <MainTabNavigator />;
}

export default function RootNavigator() {
  return (
    <NavigationContainer
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
