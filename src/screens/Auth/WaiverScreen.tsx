/**
 * WaiverScreen — full-screen modal gate shown to parents who have not yet
 * signed the active liability waiver for their tenant.
 *
 * Gate rules:
 *   • Scrollable body; "I Agree" button stays disabled until the user has
 *     scrolled within 40px of the bottom of the waiver text.
 *   • On confirmation, calls sign_waiver() RPC (idempotent).
 *   • Modal disappears as soon as the query cache is invalidated (parent
 *     component re-renders when needsWaiver becomes false).
 */

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { ActiveWaiver } from '@/api/waivers';
import { useSignWaiver } from '@/hooks/useWaiver';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = {
  waiver: ActiveWaiver;
};

const SCROLL_THRESHOLD = 40;

export default function WaiverScreen({ waiver }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const { mutateAsync: signWaiver, isPending } = useSignWaiver();

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (scrolledToBottom) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom <= SCROLL_THRESHOLD) {
      setScrolledToBottom(true);
    }
  }

  async function handleAgree() {
    try {
      await signWaiver(waiver.id);
    } catch (err) {
      Alert.alert('Could not save waiver', errorMessage(err));
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>REQUIRED</Text>
          <Text style={styles.title}>Liability Waiver</Text>
          <Text style={styles.subtitle}>
            Version {waiver.version} · Effective {waiver.effective_date}
          </Text>
        </View>

        {/* Waiver body */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
        >
          <Text style={styles.body}>{waiver.body_text}</Text>

          {/* Trailing spacer so "I Agree" is never hidden under the body */}
          <View style={{ height: spacing['4xl'] }} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {!scrolledToBottom && (
            <Text style={styles.hint}>{'Scroll to the bottom to enable "I Agree"'}</Text>
          )}
          <TouchableOpacity
            style={[styles.agreeBtn, !scrolledToBottom && styles.agreeBtnDisabled]}
            onPress={handleAgree}
            disabled={!scrolledToBottom || isPending}
            activeOpacity={0.85}
          >
            {isPending ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.agreeBtnText}>I Agree</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.darkest,
  },

  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.gold,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
  },
  body: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 22,
  },

  footer: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['4xl'],
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  hint: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  agreeBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  agreeBtnDisabled: {
    opacity: 0.35,
  },
  agreeBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.dark,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
});
