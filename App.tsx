import { StripeProvider } from '@stripe/stripe-react-native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import RootNavigator from '@/navigation/RootNavigator';
import { colors, useAppFonts } from '@/theme';

// Suppress a spurious forwardRef warning emitted by @stripe/stripe-react-native
// at startup in Expo Go. The library's internal components use the legacy
// two-argument forwardRef signature that React 19 flags as a dev warning.
// This filter is dev-only and has zero production impact.
if (__DEV__) {
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('forwardRef render functions accept exactly two parameters')) return;
    _origError(...args);
  };
}

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function App() {
  const [fontsLoaded] = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.gold} size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  const inner = (
    <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} merchantIdentifier="merchant.com.fittheorem.ballpark">
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <RootNavigator />
                <StatusBar style="light" />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StripeProvider>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webShell}>
        <View style={styles.phoneFrame}>
          {inner}
        </View>
      </View>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webShell: {
    flex: 1,
    backgroundColor: colors.darker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    width: 390,
    maxWidth: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: colors.darkest,
  },
});
