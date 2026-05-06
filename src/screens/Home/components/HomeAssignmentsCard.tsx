/**
 * HomeAssignmentsCard — single summary card surfacing pending drill
 * assignments on the parent Home tab.
 *
 * Spec (v0.6 task §Done looks like): show count of pending drills and
 * the soonest due date; tapping opens the Work tab. We deliberately do
 * NOT list individual drills here — the Work tab is the list surface.
 *
 * Renders nothing when there are zero pending drills, so a caught-up
 * parent's Home stays uncluttered.
 */

import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AssignmentWithRefs } from '@/api/assignments';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  assignments: AssignmentWithRefs[];
  onPress: () => void;
};

function formatDue(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays < 7) return `Due in ${diffDays} days`;
  return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function HomeAssignmentsCard({ assignments, onPress }: Props) {
  const pending = assignments.filter((a) => a.status === 'pending');
  if (pending.length === 0) return null;

  // Soonest due date among pending drills (nulls sort last).
  const withDue = pending.filter((a): a is AssignmentWithRefs & { due_date: string } => !!a.due_date);
  withDue.sort((a, b) => a.due_date.localeCompare(b.due_date));
  const soonest = withDue[0]?.due_date ?? null;

  const summary = soonest
    ? formatDue(soonest)
    : 'No due date set';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${pending.length} drill${pending.length === 1 ? '' : 's'} due, ${summary}`}
    >
      <View style={styles.iconWrap}>
        <Dumbbell size={20} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>Drills due</Text>
        <Text style={styles.title}>
          {pending.length} drill{pending.length === 1 ? '' : 's'} to do
        </Text>
        <Text style={styles.meta}>{summary}</Text>
      </View>
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: 2,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  meta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
  },
});
