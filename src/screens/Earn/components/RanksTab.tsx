import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { useLeaderboard } from '@/hooks/useLeaderboard';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function RanksTab({ ownKidIds }: { ownKidIds: string[] }) {
  const { data, isPending, isError, error } = useLeaderboard();
  const ownSet = new Set(ownKidIds);

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{(error as Error)?.message ?? 'Could not load ranks'}</Text>
      </View>
    );
  }

  const rows = data ?? [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.kidId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Tenant Leaderboard</Text>
          <Text style={styles.subtitle}>Top 50 athletes by total points</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No athletes ranked yet.</Text>}
      renderItem={({ item }) => {
        const mine = ownSet.has(item.kidId);
        return (
          <View style={[styles.row, mine && styles.rowMine]}>
            <View style={[styles.rankPill, item.rank <= 3 && styles.rankPillTop]}>
              <Text
                style={[styles.rankText, item.rank <= 3 && styles.rankTextTop]}
              >
                #{item.rank}
              </Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.name}>
                {item.firstName} {item.lastName}
                {mine ? ' · YOU' : ''}
              </Text>
            </View>
            <Text style={styles.points}>{item.pointsBalance.toLocaleString()}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  header: {
    paddingVertical: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  subtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  rowMine: {
    borderColor: colors.gold,
  },
  rankPill: {
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankPillTop: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  rankText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
    letterSpacing: tracking.wide,
  },
  rankTextTop: {
    color: colors.dark,
  },
  rowBody: { flex: 1 },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  points: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing['5xl'],
  },
});
