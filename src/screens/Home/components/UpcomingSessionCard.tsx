import { CalendarPlus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

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
        style={({ pressed }) => [styles.card, styles.emptyCard, pressed && styles.pressed]}
      >
        <CalendarPlus size={20} color={colors.gold} />
        <Text style={styles.emptyText}>
          No upcoming sessions — book one!
        </Text>
      </Pressable>
    );
  }

  const subtitleParts: string[] = [];
  if (durationMinutes != null) subtitleParts.push(`${durationMinutes} min`);
  if (isPast) subtitleParts.push('Past');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Text style={styles.eyebrow}>
        {formatDate(date)} · {formatTime(date)}
      </Text>
      <Text style={styles.title} numberOfLines={1}>
        {coachName} · {location}
      </Text>
      {subtitleParts.length > 0 ? (
        <Text style={styles.subtitle}>{subtitleParts.join(' · ')}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['3xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
  },
  pressed: {
    opacity: 0.85,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 72,
  },
  emptyText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    flexShrink: 1,
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
