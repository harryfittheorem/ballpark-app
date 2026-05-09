/**
 * LatestPersonalBestCard — v0.7 task #119.
 *
 * Real card on Home, backed by `personal_bests`. Renders an empty state
 * (no PR yet → "head to the cage") rather than hiding entirely so the
 * Home rhythm is preserved for new families.
 */

import { Award, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PersonalBest } from '@/api/swings';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

const METRIC_LABELS: Record<string, string> = {
  exit_velocity_mph: 'EXIT VELO',
  launch_angle_deg: 'LAUNCH ANGLE',
  distance_ft: 'DISTANCE',
  pitch_speed_mph: 'PITCH SPEED',
};

const METRIC_UNITS: Record<string, string> = {
  exit_velocity_mph: 'MPH',
  launch_angle_deg: '°',
  distance_ft: 'FT',
  pitch_speed_mph: 'MPH',
};

type Props = {
  pr: PersonalBest | null;
  onPress?: () => void;
};

function fmt(v: number, metric: string) {
  if (metric === 'distance_ft' || metric === 'launch_angle_deg') return Math.round(v).toString();
  return Number(v).toFixed(1);
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function LatestPersonalBestCard({ pr, onPress }: Props) {
  if (!pr) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Award size={16} color={colors.gold} />
          <Text style={styles.headerLabel}>LATEST PERSONAL BEST</Text>
        </View>
        <Text style={styles.emptyTitle}>No personal best yet</Text>
        <Text style={styles.emptyBody}>
          Your first PR will land here as soon as HitTrax syncs your next cage session.
        </Text>
      </View>
    );
  }

  const interactive = !!onPress && !!pr.swing_id;
  const inner = (
    <>
      <View style={styles.headerRow}>
        <Award size={16} color={colors.gold} />
        <Text style={styles.headerLabel}>LATEST PERSONAL BEST</Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{fmt(Number(pr.value), pr.metric)}</Text>
        <View style={styles.unitBlock}>
          <Text style={styles.unit}>{METRIC_UNITS[pr.metric] ?? ''}</Text>
          <View style={styles.prPip}>
            <Star size={10} color={colors.dark} fill={colors.dark} />
            <Text style={styles.prText}>NEW PR</Text>
          </View>
        </View>
      </View>
      <Text style={styles.metricLabel}>
        {(METRIC_LABELS[pr.metric] ?? pr.metric).toUpperCase()} · {timeAgo(pr.achieved_at)}
      </Text>
    </>
  );

  return interactive ? (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {inner}
    </Pressable>
  ) : (
    <View style={styles.card}>{inner}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['3xl'],
  },
  pressed: { opacity: 0.85 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.lg,
  },
  headerLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  value: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['5xl'],
    lineHeight: fontSizes['5xl'] + 4,
  },
  unitBlock: { paddingBottom: spacing.base, alignItems: 'flex-start', gap: spacing.xs },
  unit: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
  },
  prPip: {
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
  metricLabel: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
  },
  emptyBody: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.base,
    lineHeight: 20,
  },
});
