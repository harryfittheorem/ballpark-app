/**
 * ConnectHitTraxBanner — prompts the parent to connect HitTrax so cage
 * swings flow into the app within ~5 minutes (task #118).
 *
 * Rendering rules (driven by the caller via the `link` prop):
 *   - link === undefined          → loading (render nothing)
 *   - link === null               → no link yet → "Connect HitTrax" CTA
 *   - link.association_status:
 *       'pending'                 → "Check your inbox" pill, no CTA
 *       'declined' | 'removed'    → "Re-connect HitTrax" CTA
 *       'active'                  → render nothing
 *
 * Tapping the CTA navigates to Me → ConnectHitTrax (cross-tab nav via the
 * tab nav child screen param).
 */

import { Activity } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { KidCaptureLink } from '@/api/hittrax';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  link: KidCaptureLink | null | undefined;
  onPress: () => void;
};

export default function ConnectHitTraxBanner({ link, onPress }: Props) {
  // Hide for active links and during the initial fetch.
  if (link === undefined) return null;
  if (link?.association_status === 'active') return null;

  const isPending = link?.association_status === 'pending';
  const ctaLabel =
    link?.association_status === 'declined' ||
    link?.association_status === 'removed'
      ? 'Re-connect HitTrax'
      : 'Connect HitTrax';

  return (
    <Pressable
      onPress={isPending ? undefined : onPress}
      disabled={isPending}
      style={({ pressed }) => [
        styles.card,
        pressed && !isPending ? styles.pressed : null,
      ]}
      accessibilityRole={isPending ? 'text' : 'button'}
      accessibilityLabel={
        isPending ? 'HitTrax connection pending' : 'Connect HitTrax'
      }
      testID="hittrax-banner"
    >
      <View style={styles.iconCircle}>
        <Activity size={20} color={colors.gold} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>
          {isPending ? 'SETTING UP HITTRAX' : 'TRACK EVERY CAGE SWING'}
        </Text>
        <Text style={styles.subtitle}>
          {isPending
            ? 'We sent a confirmation email to your athlete. Tap the link to finish.'
            : 'Connect HitTrax so swings show up here automatically — and earn points for every personal best.'}
        </Text>
        {!isPending ? <Text style={styles.cta}>{ctaLabel} →</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(216, 168, 60, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: fontSizes.sm * 1.4,
  },
  cta: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
  },
});
