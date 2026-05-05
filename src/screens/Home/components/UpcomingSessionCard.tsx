import { CalendarPlus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  date?: Date;
  durationMinutes?: number;
  coachName?: string;
  location?: string;
  isPast?: boolean;
  onPress?: () => void;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

function formatDate(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatTime(date: Date): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours12}:${minutesStr} ${period}`;
}

export default function UpcomingSessionCard({
  date,
  durationMinutes,
  coachName,
  location,
  isPast,
  onPress = () => {},
}: Props) {
  const hasSession = date != null && coachName != null && location != null;

  if (!hasSession) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
      >
        <View style={[styles.card, styles.emptyCard]}>
          <View style={styles.goldEdge} pointerEvents="none" />
          <View style={styles.emptyBody}>
            <CalendarPlus size={20} color={colors.gold} />
            <Text style={styles.emptyText}>
              No upcoming sessions — book one!
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  const meta: string[] = [];
  if (durationMinutes != null) meta.push(`${durationMinutes} min`);
  if (isPast) meta.push('Past');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
    >
      <View style={styles.card}>
        <View style={styles.goldEdge} pointerEvents="none" />
        <View style={styles.body}>
          <Text style={styles.eyebrow}>UPCOMING SESSION</Text>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
          <Text style={styles.timeText}>{formatTime(date)}</Text>
          <Text style={styles.coachLine} numberOfLines={1}>
            {coachName} • {location}
          </Text>
          {meta.length > 0 ? (
            <Text style={styles.metaText}>{meta.join(' • ')}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.darkest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: radius['5xl'],
  },
  pressed: {
    opacity: 0.85,
  },
  card: {
    borderRadius: radius['5xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  emptyCard: {
    minHeight: 96,
    justifyContent: 'center',
  },
  goldEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.gold,
  },
  body: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  dateText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
    marginTop: spacing.xs,
  },
  timeText: {
    fontFamily: fontFamilies.oswaldMedium,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    opacity: 0.85,
    marginTop: spacing.xxs,
  },
  coachLine: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    opacity: 0.85,
    marginTop: spacing.lg,
  },
  metaText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  emptyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  emptyText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    flexShrink: 1,
  },
});
