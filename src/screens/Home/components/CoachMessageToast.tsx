/**
 * In-app toast that nudges the parent to watch a freshly-arrived coach
 * video. Mounted inside HomeScreen (the only tab the spec requires it on)
 * and listens to `useNewCoachMessage` for state.
 *
 * Behaviour (Step 4.14):
 *   - Slides in from the top when `isNew` flips true.
 *   - Tapping it: marks the message seen, dismisses, and navigates to
 *     the Video Playback screen with the new message id.
 *   - Auto-dismisses after ~5s by marking the message seen and animating
 *     out — the underlying message id is captured at the time of arrival
 *     so a quick second message doesn't get swallowed by the timer.
 */

import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNewCoachMessage } from '@/hooks/useNewCoachMessage';
import type { HomeStackScreenProps } from '@/navigation/types';
import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
} from '@/theme';

type Nav = HomeStackScreenProps<'HomeMain'>['navigation'];

const AUTO_DISMISS_MS = 5000;
const SLIDE_DISTANCE = 80;

export default function CoachMessageToast() {
  const navigation = useNavigation<Nav>();
  const { isNew, message, markSeen } = useNewCoachMessage();

  const translateY = useRef(new Animated.Value(-SLIDE_DISTANCE)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // `mounted` keeps the Animated.View in the tree long enough for the
  // slide-out to play after `isNew` flips false. We flip it to false from
  // the animation completion callback.
  const [mounted, setMounted] = useState(false);

  // Slide in / out whenever the new-message state flips. We avoid putting
  // `markSeen` in the dep array because it's a new function ref every
  // render and would otherwise re-trigger the dismiss timer endlessly.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isNew && message) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      timer = setTimeout(() => {
        markSeen();
      }, AUTO_DISMISS_MS);
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -SLIDE_DISTANCE,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, message?.id]);

  if (!mounted) return null;

  const coachName = message?.coach
    ? `${message.coach.firstName} ${message.coach.lastName}`.trim()
    : 'Your coach';

  const onPress = () => {
    if (!message) return;
    const id = message.id;
    markSeen();
    navigation.navigate('VideoPlayback', { messageId: id });
  };

  return (
    <Animated.View
      pointerEvents={isNew ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${coachName} sent a new video. Tap to watch.`}
          style={({ pressed }) => [styles.toast, pressed && styles.pressed]}
        >
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            {coachName} sent a new video!
          </Text>
        </Pressable>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: spacing['3xl'],
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.base,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    opacity: 0.85,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  text: {
    flex: 1,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
});
