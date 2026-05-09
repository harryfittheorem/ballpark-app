import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AssignmentWithRefs } from '@/api/assignments';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  assignments: AssignmentWithRefs[];
  onPress: () => void;
};

function formatDue(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 7) return `Due in ${diffDays} days`;
  return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function HomeAssignmentsCard({ assignments, onPress }: Props) {
  const pending = assignments.filter((a) => a.status === 'pending');
  if (pending.length === 0) return null;

  const sorted = [...pending].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  const top = sorted.slice(0, 2);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Dumbbell size={18} color={colors.gold} />
        </View>
        <Text style={styles.eyebrow}>ASSIGNMENTS</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="See all assignments"
          style={styles.seeAllPress}
        >
          <Text style={styles.seeAll}>SEE ALL</Text>
          <ChevronRight size={14} color={colors.gold} />
        </Pressable>
      </View>

      {top.map((a) => (
        <Pressable
          key={a.id}
          onPress={onPress}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {formatDue(a.due_date)}
            </Text>
          </View>
          <View style={styles.pointsPill}>
            <Text style={styles.pointsPillText}>+{a.point_reward ?? 25} PTS</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  seeAllPress: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAll: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { opacity: 0.85 },
  rowTitle: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.textOnDark,
  },
  rowMeta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
  },
  pointsPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  pointsPillText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.dark,
    letterSpacing: tracking.wide,
  },
});
