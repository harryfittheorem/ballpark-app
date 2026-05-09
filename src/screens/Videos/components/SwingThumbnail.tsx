/**
 * SwingThumbnail — single 3:4 tile rendered inside a 3-column grid on
 * Videos → Swings + Favorites and a 4-column grid on Session Detail.
 *
 * No real per-swing video clip exists yet (HitTrax is metric-only — the
 * Mux-clip-per-swing pipeline is a future task). To keep the visual
 * layout honest now and forward-compatible later, we render a dark
 * placeholder card with the headline metric (exit velo) overlaid plus a
 * gold "PR" pip when `is_personal_best`. When per-swing Mux clips ship,
 * we just swap the placeholder background for an `<Image source={{ uri:
 * muxPosterUrl(...) }} />` without touching the grid layout.
 */

import { Heart, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Swing } from '@/api/swings';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  swing: Swing;
  favorited?: boolean;
  onPress: () => void;
};

function formatVelo(v: number | null): string {
  if (v == null) return '—';
  return `${Number(v).toFixed(1)}`;
}

export default function SwingThumbnail({ swing, favorited, onPress }: Props) {
  const velo = formatVelo(swing.exit_velocity_mph);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.bg} />
      {swing.is_personal_best ? (
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
      <View style={styles.metricBlock}>
        <Text style={styles.veloValue}>{velo}</Text>
        <Text style={styles.veloUnit}>MPH</Text>
      </View>
    </Pressable>
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
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.darker },
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
  metricBlock: {
    alignItems: 'flex-start',
  },
  veloValue: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
  },
  veloUnit: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
});
