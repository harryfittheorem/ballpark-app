/**
 * RanksScreen — v0.7 task #122 podium rebuild.
 *
 * Spec §5.15 layout:
 *   - 2nd / 1st / 3rd podium with circular avatars (initial), name,
 *     gold podium bar for #1, rank badge on the bar, value below.
 *   - Gold-tinted "you" card with current rank + weekly delta
 *     ("+3 ↑" if you climbed 3 spots this week).
 *   - Top-25 list with self-row highlighted (gold tint + gold border).
 *
 * Data sources: live `kids` query for the current ranking, and a 7-day-
 * old snapshot reconstructed by reversing every points_ledger delta in
 * the past 7 days (see `getKidsRanksSevenDaysAgo` in api/earn.ts).
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFamily } from '@/hooks/useFamily';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useWeeklyRankDelta } from '@/hooks/useWeeklyRankDelta';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function RanksScreen() {
  const { kids } = useFamily();
  const ownKidId = kids[0]?.id ?? null;
  const { data, isPending, isError, error } = useLeaderboard();
  const { data: delta } = useWeeklyRankDelta(ownKidId);

  const rows = data ?? [];
  const podium = useMemo(() => rows.slice(0, 3), [rows]);
  const top25 = useMemo(() => rows.slice(0, 25), [rows]);
  const ownRow = ownKidId ? rows.find((r) => r.kidId === ownKidId) ?? null : null;

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }
  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {(error as Error)?.message ?? 'Could not load ranks'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ranks</Text>
          <Text style={styles.subtitle}>Tenant leaderboard, top to bottom</Text>
        </View>

        {/* Podium ----------------------------------------------------- */}
        {podium.length > 0 ? (
          <View style={styles.podiumRow}>
            {/* 2nd */}
            <PodiumColumn entry={podium[1] ?? null} rank={2} height={92} />
            {/* 1st */}
            <PodiumColumn entry={podium[0] ?? null} rank={1} height={132} isFirst />
            {/* 3rd */}
            <PodiumColumn entry={podium[2] ?? null} rank={3} height={68} />
          </View>
        ) : null}

        {/* You card --------------------------------------------------- */}
        {ownRow ? (
          <View style={styles.youCard}>
            <View style={styles.youInner}>
              <View style={styles.youAvatar}>
                <Text style={styles.youInitial}>
                  {ownRow.firstName[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.youLabel}>YOU</Text>
                <Text style={styles.youName}>
                  {ownRow.firstName} {ownRow.lastName}
                </Text>
              </View>
              <View style={styles.youRight}>
                <Text style={styles.youRank}>#{ownRow.rank}</Text>
                {delta != null && delta !== 0 ? (
                  <Text
                    style={[
                      styles.youDelta,
                      delta > 0 ? styles.youDeltaUp : styles.youDeltaDown,
                    ]}
                  >
                    {delta > 0 ? `+${delta} ↑` : `${delta} ↓`}
                  </Text>
                ) : (
                  <Text style={styles.youDeltaFlat}>—</Text>
                )}
              </View>
            </View>
            <Text style={styles.youPoints}>
              {ownRow.pointsBalance.toLocaleString()} pts
            </Text>
          </View>
        ) : null}

        {/* Top 25 list ------------------------------------------------ */}
        <Text style={styles.sectionLabel}>TOP 25</Text>
        {top25.length === 0 ? (
          <Text style={styles.empty}>No athletes ranked yet.</Text>
        ) : (
          top25.map((row) => {
            const mine = row.kidId === ownKidId;
            return (
              <View key={row.kidId} style={[styles.row, mine && styles.rowMine]}>
                <Text style={[styles.rowRank, mine && styles.rowRankMine]}>
                  #{row.rank}
                </Text>
                <Text style={[styles.rowName, mine && styles.rowNameMine]} numberOfLines={1}>
                  {row.firstName} {row.lastName}
                </Text>
                <Text style={styles.rowPoints}>{row.pointsBalance.toLocaleString()}</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PodiumColumn({
  entry,
  rank,
  height,
  isFirst,
}: {
  entry: { firstName: string; lastName: string; pointsBalance: number } | null;
  rank: number;
  height: number;
  isFirst?: boolean;
}) {
  const initial = entry?.firstName[0]?.toUpperCase() ?? '–';
  const display = entry ? entry.firstName : '—';
  const value = entry ? entry.pointsBalance.toLocaleString() : '—';
  return (
    <View style={styles.podiumCol}>
      <View
        style={[
          styles.podiumAvatar,
          isFirst && styles.podiumAvatarFirst,
          !entry && styles.podiumAvatarEmpty,
        ]}
      >
        <Text
          style={[styles.podiumAvatarText, isFirst && styles.podiumAvatarTextFirst]}
        >
          {initial}
        </Text>
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>
        {display}
      </Text>
      <Text style={styles.podiumValue}>{value}</Text>
      <View
        style={[
          styles.podiumBar,
          { height },
          isFirst ? styles.podiumBarFirst : styles.podiumBarOther,
        ]}
      >
        <Text style={[styles.podiumBarRank, isFirst && styles.podiumBarRankFirst]}>
          {rank}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['7xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  header: { marginBottom: spacing['3xl'] },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },

  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing['4xl'],
  },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  podiumAvatarFirst: {
    width: 72,
    height: 72,
    borderColor: colors.gold,
    backgroundColor: colors.gold,
  },
  podiumAvatarEmpty: { opacity: 0.5 },
  podiumAvatarText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  podiumAvatarTextFirst: { color: colors.dark, fontSize: fontSizes['3xl'] },
  podiumName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    marginBottom: 2,
  },
  podiumValue: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBarFirst: {
    backgroundColor: colors.gold,
  },
  podiumBarOther: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  podiumBarRank: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  podiumBarRankFirst: { color: colors.dark, fontSize: fontSizes['3xl'] },

  youCard: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    marginBottom: spacing['4xl'],
  },
  youInner: { flexDirection: 'row', alignItems: 'center', gap: spacing['2xl'] },
  youAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youInitial: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.dark,
  },
  youLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  youName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    marginTop: 2,
  },
  youRight: { alignItems: 'flex-end' },
  youRank: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  youDelta: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  youDeltaUp:   { color: colors.success },
  youDeltaDown: { color: colors.danger },
  youDeltaFlat: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  youPoints: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.lg,
  },

  sectionLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing['5xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xl'],
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.sm,
  },
  rowMine: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
  },
  rowRank: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    minWidth: 40,
  },
  rowRankMine: { color: colors.gold },
  rowName: {
    flex: 1,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  rowNameMine: { color: colors.gold },
  rowPoints: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
});
