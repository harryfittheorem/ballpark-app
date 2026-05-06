/**
 * HomeAssignmentsCard — surfaces up to 2 pending drill assignments on
 * Home so the parent has a one-tap path into the Work tab. Tap any row
 * jumps cross-tab to Work → AssignmentDetail.
 *
 * Renders nothing (returns null) when there are no pending drills,
 * keeping the Home layout uncluttered for parents who are caught up.
 */

import { ChevronRight, Dumbbell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AssignmentWithRefs } from '@/api/assignments';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

const MAX_PREVIEW = 2;

type Props = {
  assignments: AssignmentWithRefs[];
  onPressAssignment: (assignmentId: string) => void;
  onSeeAll: () => void;
};

export default function HomeAssignmentsCard({ assignments, onPressAssignment, onSeeAll }: Props) {
  const pending = assignments.filter((a) => a.status === 'pending').slice(0, MAX_PREVIEW);
  if (pending.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Dumbbell size={16} color={colors.gold} />
          <Text style={styles.eyebrow}>Drills to do</Text>
        </View>
        <Pressable onPress={onSeeAll} accessibilityRole="button">
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      {pending.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onPressAssignment(a.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Drill: ${a.title}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{a.title}</Text>
            <Text style={styles.meta}>
              {a.duration_estimate_minutes != null ? `${a.duration_estimate_minutes} min · ` : ''}
              +{a.point_reward} pts
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textMuted} />
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
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  seeAll: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  meta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
});
