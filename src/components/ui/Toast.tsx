/**
 * Minimal in-app toast system.
 *
 * `ToastProvider` mounts a single absolutely-positioned banner near the top
 * of the screen and exposes a `useToast()` hook so any screen can fire
 * `showToast('Message')`. The banner fades + slides in, sits for ~3s, then
 * fades out. Intentionally tiny — we don't need queues or variants for v0.3.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
} from '@/theme';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2800;
const FADE_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  useEffect(() => () => clearHideTimer(), []);

  const showToast = useCallback(
    (msg: string) => {
      clearHideTimer();
      setMessage(msg);
      opacity.setValue(0);
      translateY.setValue(-12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      hideTimer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: FADE_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: -12,
            duration: FADE_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished) setMessage(null);
        });
      }, VISIBLE_MS);
    },
    [opacity, translateY],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <SafeAreaView
          pointerEvents="none"
          style={styles.host}
          edges={['top']}
        >
          <Animated.View
            style={[
              styles.toast,
              { opacity, transform: [{ translateY }] },
            ]}
          >
            <Text style={styles.text} numberOfLines={2}>
              {message}
            </Text>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback so a missing provider never crashes the app.
    return { showToast: () => undefined };
  }
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    marginTop: spacing.lg,
    marginHorizontal: spacing['3xl'],
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.xl,
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    maxWidth: 360,
  },
  text: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});

// Bare-View component used in tests / storybook if needed later.
export function ToastBanner({ message }: { message: string }) {
  return (
    <View style={styles.toast}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}
