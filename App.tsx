import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import RootNavigator from '@/navigation/RootNavigator';
import { colors, useAppFonts } from '@/theme';

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

  return (
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
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
