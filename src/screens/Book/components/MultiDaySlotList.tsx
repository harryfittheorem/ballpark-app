import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoaches } from '../hooks/useCoaches';
import { useDayBookings } from '../hooks/useDayBookings';
import { usePrimaryLocation } from '../hooks/usePrimaryLocation';
import { formatSlotTime, generateDaySlots, type Slot, type AvailabilityForSlots } from '../utils/slots';
import type { SessionType } from '@/api/bookings';
import type { Coach } from '@/api/bookings';

type Props = {
  sessionType: SessionType | null;
  onPickSlot: (date: string, slot: Slot) => void;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getShortDayLabel(date: string, index: number): string {
  if (index === 0) return 'TODAY';
  if (index === 1) return 'TOMORROW';
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
}

function getMonthDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function DayColumn({
  date,
  dayLabel,
  monthDay,
  sessionType,
  availability,
  coaches,
  timezone,
  onPickSlot,
}: {
  date: string;
  dayLabel: string;
  monthDay: string;
  sessionType: SessionType;
  availability: AvailabilityForSlots[] | undefined;
  coaches: Coach[] | undefined;
  timezone: string | null;
  onPickSlot: (slot: Slot) => void;
}) {
  const bookings = useDayBookings(date, timezone);
  const isPending = bookings.isPending || !availability;

  const slots =
    !isPending && availability && bookings.data
      ? generateDaySlots({
          date,
          durationMinutes: sessionType.duration_minutes,
          timezone,
          availability,
          bookings: bookings.data,
        })
      : [];

  const coachFirstName = (id: string) => {
    const c = coaches?.find((x) => x.id === id);
    return c?.first_name ?? 'Coach';
  };

  return (
    <View style={styles.column}>
      <View style={styles.colHeader}>
        <Text style={styles.colDayLabel}>{dayLabel}</Text>
        <Text style={styles.colMonthDay}>{monthDay}</Text>
      </View>
      <View style={styles.colDivider} />

      {isPending ? (
        <View style={styles.colState}>
          <ActivityIndicator size="small" color={colors.gold} />
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.colState}>
          <Text style={styles.colNoneText}>None open</Text>
        </View>
      ) : (
        <View style={styles.chips}>
          {slots.map((slot) => (
            <Pressable
              key={`${slot.coach_id}|${slot.start}`}
              onPress={() => onPickSlot(slot)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${formatSlotTime(slot.start, timezone)} with ${coachFirstName(slot.coach_id)}`}
            >
              <Text style={styles.chipTime}>{formatSlotTime(slot.start, timezone)}</Text>
              <Text style={styles.chipCoach}>{coachFirstName(slot.coach_id)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MultiDaySlotList({ sessionType, onPickSlot }: Props) {
  const availability = useCoachAvailability();
  const location = usePrimaryLocation();
  const coaches = useCoaches();

  const timezone = location.data?.timezone ?? null;

  const today = new Date();
  const days = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return ymd(d);
  });

  if (!sessionType) {
    return (
      <View style={styles.noTypeHint}>
        <Text style={styles.noTypeText}>
          Pick a session type above to see open slots.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {days.map((date, i) => (
        <DayColumn
          key={date}
          date={date}
          dayLabel={getShortDayLabel(date, i)}
          monthDay={getMonthDay(date)}
          sessionType={sessionType}
          availability={availability.data}
          coaches={coaches.data}
          timezone={timezone}
          onPickSlot={(slot) => onPickSlot(date, slot)}
        />
      ))}
    </ScrollView>
  );
}

const COLUMN_WIDTH = 116;

const styles = StyleSheet.create({
  noTypeHint: {
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noTypeText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    textAlign: 'center',
  },
  row: {
    gap: spacing.base,
    paddingRight: spacing.lg,
    alignItems: 'stretch',
  },
  column: {
    width: COLUMN_WIDTH,
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  colHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
  },
  colDayLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  colMonthDay: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    marginTop: 1,
  },
  colDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.base,
  },
  colState: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  colNoneText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
  chips: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.lg,
    gap: spacing.base,
  },
  chip: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  chipPressed: {
    backgroundColor: 'rgba(241, 229, 173, 0.18)',
  },
  chipTime: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.tight,
    textAlign: 'center',
  },
  chipCoach: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    marginTop: 2,
  },
});
