/**
 * SwingThumbnail — single 3:4 tile rendered inside the Videos grids and
 * the Session Detail screen.
 *
 * Anatomy (per task #119 spec):
 *   - dark background (per-swing Mux clip ships in a future task; until
 *     then we render a centered Play icon over a gradient backdrop).
 *   - PR variant: gold gradient backdrop + "PR" pip top-left.
 *   - Heart pip top-right when favorited.
 *   - Bottom metric strip: Exit velo / Launch / Distance.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Heart, Play, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Swing } from '@/api/swings';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  swing: Swing;
  favorited?: boolean;
  onPress: () => void;
};

function fmt1(v: number | null | undefined): string {
  if (v == null) return '—';
  return Number(v).toFixed(1);
}
function fmt0(v: number | null | undefined): string {
  if (v == null) return '—';
  return String(Math.round(Number(v)));
}
export default function SwingThumbnail({ swing, favorited, onPress }: Props) {
  const isPr = !!swing.is_personal_best;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        isPr && styles.cardPr,
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={
          isPr
            ? ['rgba(241, 229, 173, 0.35)', 'rgba(184, 162, 104, 0.55)']
            : [colors.dark, colors.darker]
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.playWrap} pointerEvents="none">
        <View style={[styles.playCircle, isPr && styles.playCirclePr]}>
          <Play
            size={20}
            color={isPr ? colors.dark : colors.gold}
            fill={isPr ? colors.dark : colors.gold}
          />
        </View>
      </View>
      {isPr ? (
        <View style={styles.prPip}>
          <Star size={10} color={colors.dark} fill={colors.dark} />
          <Text style={styles.prText}>PR</Text>
        </View>
      ) : null}
      {favorited ? (
        <View style={styles.heart}>
          <Heart size={12} color={colors.gold} fill={colors.gold} />
        </View>
      ) : null}
      <View style={styles.metricStrip}>
        <Metric label="EV" value={fmt1(swing.exit_velocity_mph)} pr={isPr} />
        <Metric label="DIST" value={fmt0(swing.distance_ft)} pr={isPr} />
      </View>
    </Pressable>
  );
}

function Metric({ label, value, pr }: { label: string; value: string; pr: boolean }) {
  return (
    <View style={styles.metricCell}>
      <Text style={[styles.metricVal, pr && styles.metricValPr]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 3 / 4,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'flex-end',
  },
  cardPr: { borderColor: colors.gold },
  pressed: { opacity: 0.85 },
  playWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 14, 14, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCirclePr: { backgroundColor: 'rgba(241, 229, 173, 0.95)' },
  prPip: {
    position: 'absolute',
    top: spacing.base,
    left: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  prText: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
  heart: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
  },
  metricStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    backgroundColor: 'rgba(15, 14, 14, 0.55)',
  },
  metricCell: { alignItems: 'center', flex: 1 },
  metricVal: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
  },
  metricValPr: { color: colors.gold },
  metricLabel: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
    marginTop: spacing.xxs,
  },
});
