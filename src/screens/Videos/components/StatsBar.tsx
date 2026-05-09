/**
 * StatsBar — header strip used on Videos (kid totals) and Session Detail
 * (single-session totals). Three slots; pass `null` to render an em-dash.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Stat = { label: string; value: string };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  return (
    <View style={styles.row}>
      {stats.map((s, i) => (
        <View key={s.label} style={[styles.cell, i > 0 && styles.cellBorder]}>
          <Text style={styles.value}>{s.value}</Text>
          <Text style={styles.label}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing['2xl'],
  },
  cell: { flex: 1, alignItems: 'center' },
  cellBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  value: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
  },
  label: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
    marginTop: spacing.xxs,
  },
});
