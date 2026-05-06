import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { PointsLedgerEntry } from '@/api/earn';
import { usePointsLedger } from '@/hooks/usePointsLedger';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

const RULES: { label: string; points: string; detail: string }[] = [
  { label: 'Attend a session', points: '+10', detail: 'Awarded when your coach marks the booking complete.' },
  { label: 'Complete an assignment', points: '+25', detail: 'Coming soon — finish drills assigned by your coach.' },
  { label: 'Hit a personal record', points: '+50', detail: 'Coming soon — bat speed, exit velo, and more.' },
];

const REASON_LABEL: Record<string, string> = {
  session_attended: 'Session attended',
  assignment_completed: 'Assignment',
  pr_hit: 'Personal record',
  redemption: 'Reward redeemed',
  manual_adjustment: 'Adjustment',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${m} ${d.getDate()}`;
}

export default function EarnRulesTab({ kidId }: { kidId: string | null }) {
  const { data, isPending, isError } = usePointsLedger(kidId);

  return (
    <FlatList<PointsLedgerEntry>
      data={data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          <Text style={styles.section}>How you earn</Text>
          {RULES.map((r) => (
            <View key={r.label} style={styles.ruleCard}>
              <View style={styles.ruleHeader}>
                <Text style={styles.ruleLabel}>{r.label}</Text>
                <Text style={styles.rulePoints}>{r.points} PTS</Text>
              </View>
              <Text style={styles.ruleDetail}>{r.detail}</Text>
            </View>
          ))}
          <Text style={styles.section}>Recent activity</Text>
          {!kidId ? (
            <Text style={styles.empty}>Add a kid to start earning points.</Text>
          ) : isPending ? (
            <ActivityIndicator color={colors.gold} style={{ marginVertical: spacing['3xl'] }} />
          ) : isError ? (
            <Text style={styles.empty}>Could not load history.</Text>
          ) : (data ?? []).length === 0 ? (
            <Text style={styles.empty}>No points activity yet.</Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.entry}>
          <View style={styles.entryBody}>
            <Text style={styles.entryReason}>{REASON_LABEL[item.reason] ?? item.reason}</Text>
            {item.note ? <Text style={styles.entryNote}>{item.note}</Text> : null}
            <Text style={styles.entryDate}>{formatDate(item.created_at)}</Text>
          </View>
          <Text style={[styles.entryDelta, item.delta < 0 && styles.entryDeltaNeg]}>
            {item.delta > 0 ? '+' : ''}{item.delta}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  section: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginTop: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  ruleCard: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ruleLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  rulePoints: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    letterSpacing: tracking.wide,
  },
  ruleDetail: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  entryBody: { flex: 1 },
  entryReason: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  entryNote: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    marginTop: 2,
  },
  entryDate: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  entryDelta: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.success,
    letterSpacing: tracking.wide,
  },
  entryDeltaNeg: {
    color: colors.danger,
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing['3xl'],
  },
});
