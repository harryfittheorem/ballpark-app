import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { useFamily } from '@/hooks/useFamily';
import { getDaySlotAvailability, type SlotAvailability } from '@/api/waitlist';
import { useQuery } from '@tanstack/react-query';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useDayBookings } from '../hooks/useDayBookings';
import { useActiveLocation } from '../hooks/useActiveLocation';
import { formatSlotTime, generateDaySlots, dayBoundsUtcISO, type Slot, type AvailabilityForSlots } from '../utils/slots';
import type { SessionType } from '@/api/bookings';

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

function useDaySlotAvailability(
  date: string,
  sessionTypeId: string,
  timezone: string | null,
) {
  const { family } = useFamily();
  const tenantId = family?.tenant_id ?? null;

  return useQuery<Map<string, SlotAvailability>>({
    queryKey: ['slot_availability', tenantId, sessionTypeId, date, timezone ?? null],
    queryFn: async () => {
      const { startISO, endISO } = dayBoundsUtcISO(date, timezone);
      return getDaySlotAvailability({
        tenant_id: tenantId as string,
        session_type_id: sessionTypeId,
        start: startISO,
        end: endISO,
      });
    },
    enabled: !!tenantId && !!date && !!sessionTypeId,
    staleTime: 30_000,
  });
}

function capacityLabel(info: SlotAvailability | undefined): string | null {
  if (!info) return null;
  const remaining = info.capacity - info.confirmed_count;
  if (remaining <= 0) return 'Full';
  if (info.capacity === 1) return null;
  return `${remaining} of ${info.capacity}`;
}

function slotKey(slot: Slot): string {
  return `${slot.coach_id}_${new Date(slot.start).toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
}

function DayColumn({
  date,
  dayLabel,
  monthDay,
  sessionType,
  availability,
  timezone,
  onPickSlot,
}: {
  date: string;
  dayLabel: string;
  monthDay: string;
  sessionType: SessionType;
  availability: AvailabilityForSlots[] | undefined;
  timezone: string | null;
  onPickSlot: (slot: Slot) => void;
}) {
  const bookings = useDayBookings(date, timezone);
  const slotAvail = useDaySlotAvailability(date, sessionType.id, timezone);
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
          {slots.map((slot) => {
            const key = slotKey(slot);
            const info = slotAvail.data?.get(key);
            const isFull = !!info && info.confirmed_count >= info.capacity;
            const capLabel = capacityLabel(info);
            return (
              <Pressable
                key={`${slot.coach_id}|${slot.start}`}
                onPress={() => onPickSlot(slot)}
                style={({ pressed }) => [
                  styles.chip,
                  isFull && styles.chipFull,
                  pressed && !isFull && styles.chipPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${formatSlotTime(slot.start, timezone)}${isFull ? ', full' : ''}`}
              >
                <Text style={[styles.chipTime, isFull && styles.chipTimeFull]}>
                  {formatSlotTime(slot.start, timezone)}
                </Text>
                {capLabel ? (
                  <Text style={[styles.chipCapacity, isFull && styles.chipCapacityFull]}>
                    {capLabel}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function MultiDaySlotList({ sessionType, onPickSlot }: Props) {
  const availability = useCoachAvailability();
  const location = useActiveLocation();

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
          Loading available slots…
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
  chipFull: {
    borderColor: colors.border,
    backgroundColor: 'rgba(155,149,144,0.06)',
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
  chipTimeFull: {
    color: colors.textMuted,
  },
  chipCapacity: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    marginTop: 2,
  },
  chipCapacityFull: {
    color: colors.textMuted,
  },
});
