/**
 * Root navigator — picks between flows based on auth + role + family state:
 *   1. Loading splash (initial session check, family fetch)
 *   2. Auth stack (signed-out)
 *   3. CoachTabs (signed-in coach — skips family fetch / AddKid entirely)
 *   4. AddKid (signed-in parent, no kids yet)
 *   5. Main tabs (signed-in parent with at least one kid)
 *
 * Mounts at the NavigationContainer level. AuthProvider must wrap this.
 */

import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import AddKidScreen from '@/screens/Auth/AddKidScreen';
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

function ParentFlow() {
  const { kids, loading: famLoading, family } = useFamily();
  // Wait for the first family fetch to settle so we don't flash the AddKid
  // screen for users who already have kids.
  if (famLoading && !family) return <Splash />;
  if (kids.length === 0) return <AddKidScreen />;
  return <MainTabNavigator />;
}

function Inner() {
  const { session, loading: authLoading, appRole } = useAuth();

  if (authLoading) return <Splash />;
  if (!session) return <AuthNavigator />;
  // Coaches don't have a family record — skip useFamily entirely so we don't
  // trigger an unnecessary fetch or block on a query that would never resolve.
  if (appRole === 'coach') return <CoachTabNavigator />;
  return <ParentFlow />;
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
