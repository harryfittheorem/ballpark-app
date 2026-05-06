/**
 * AssignmentRow — single row in the Work tab list. Same chrome as
 * SentMessageRow / UpcomingSessionCard so the Work tab feels native to
 * the app. Right-side badge color encodes status:
 *   pending   → muted gold (action required)
 *   submitted → gold      (waiting on coach)
 *   reviewed  → success   (done; rating shown)
 */

import { CheckCircle2, Circle, Clock, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AssignmentWithRefs } from '@/api/assignments';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  assignment: AssignmentWithRefs;
  onPress: () => void;
};

function formatDue(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export default function AssignmentRow({ assignment, onPress }: Props) {
  const status = assignment.status;
  const due = formatDue(assignment.due_date);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Drill: ${assignment.title}`}
    >
      <View style={styles.iconWrap}>
        {status === 'pending' ? (
          <Circle size={20} color={colors.gold} />
        ) : status === 'submitted' ? (
          <Clock size={20} color={colors.gold} />
        ) : (
          <CheckCircle2 size={20} color={colors.gold} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{assignment.title}</Text>
        <View style={styles.metaRow}>
          {assignment.duration_estimate_minutes != null ? (
            <Text style={styles.meta}>{assignment.duration_estimate_minutes} min</Text>
          ) : null}
          {due ? <Text style={styles.meta}>{due}</Text> : null}
          <Text style={styles.meta}>+{assignment.point_reward} pts</Text>
        </View>
      </View>
      {status === 'reviewed' && assignment.rating != null ? (
        <View style={styles.ratingPill}>
          <Star size={12} color={colors.gold} fill={colors.gold} />
          <Text style={styles.ratingText}>{assignment.rating}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  body: { flex: 1, gap: spacing.xs },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  meta: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  ratingText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
  },
});
