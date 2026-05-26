import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useSlotAvailability } from '@/hooks/useSlotAvailability';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useDayBookings } from '../hooks/useDayBookings';
import { useActiveLocation } from '../hooks/useActiveLocation';
import {
  formatSlotTime,
  generateDaySlots,
  type Slot,
} from '../utils/slots';
import SectionCard from './SectionCard';
import type { SlotAvailability } from '@/api/waitlist';

type Props = {
  locked: boolean;
  lockedHint?: string;
  date: string | null;
  sessionTypeId?: string | null;
  durationMinutes: number | null;
  selectedSlotKey: string | null;
  onSelectSlot: (slot: Slot, eligibleCoachIds: string[]) => void;
};

function slotKey(slot: Slot): string {
  return `${slot.coach_id}_${new Date(slot.start).toISOString().replace(/\.\d{3}Z$/, 'Z')}`;
}

function capacityLabel(info: SlotAvailability | undefined): string | null {
  if (!info) return null;
  const remaining = info.capacity - info.confirmed_count;
  if (remaining <= 0) return 'Full';
  if (info.capacity === 1) return null;
  return `${remaining} of ${info.capacity}`;
}

export default function TimeSection({
  locked,
  lockedHint,
  date,
  sessionTypeId = null,
  durationMinutes,
  selectedSlotKey,
  onSelectSlot,
}: Props) {
  const availability = useCoachAvailability();
  const location = useActiveLocation();
  const tz = location.data?.timezone ?? null;
  const bookings = useDayBookings(date, tz);

  // Slot availability for capacity labels
  const slotAvail = useSlotAvailability(date, sessionTypeId ?? null, null, tz);

  const slots = useMemo<Slot[] | null>(() => {
    if (!date || durationMinutes == null || !availability.data || !bookings.data) {
      return null;
    }
    return generateDaySlots({
      date,
      durationMinutes,
      timezone: tz,
      availability: availability.data,
      bookings: bookings.data,
    });
  }, [date, durationMinutes, availability.data, bookings.data, tz]);

  const locationLoading =
    location.fetchStatus !== 'idle' && location.isPending && !location.data;
  const isPending =
    availability.isPending ||
    (bookings.isPending && !!date) ||
    locationLoading;
  const isError = availability.isError || bookings.isError || location.isError;
  const isRefetching =
    availability.isRefetching || bookings.isRefetching || location.isRefetching;
  const retry = () => {
    if (availability.isError) void availability.refetch();
    if (bookings.isError) void bookings.refetch();
    if (location.isError) void location.refetch();
  };

  // Deduplicate slots by start time — one chip per time, first available coach wins
  const uniqueSlots = useMemo(() => {
    if (!slots) return [];
    const seen = new Set<string>();
    return slots.filter((s) => {
      if (seen.has(s.start)) return false;
      seen.add(s.start);
      return true;
    });
  }, [slots]);

  return (
    <SectionCard
      title="Time"
      locked={locked}
      lockedHint={locked ? lockedHint : undefined}
    >
      {locked ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Available time slots will appear here.</Text>
        </View>
      ) : isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>Couldn&apos;t load times.</Text>
          <Text
            style={styles.retry}
            onPress={() => {
              if (!isRefetching) retry();
            }}
          >
            {isRefetching ? 'Retrying…' : 'Tap to retry'}
          </Text>
        </View>
      ) : !uniqueSlots || uniqueSlots.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.emptyText}>No times available — try another date.</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {uniqueSlots.map((slot) => {
            const key = `${slot.coach_id}|${slot.start}`;
            const selected = key === selectedSlotKey;
            const info = slotAvail.data?.get(slotKey(slot));
            const isFull = !!info && info.confirmed_count >= info.capacity;
            const capLabel = capacityLabel(info);
            return (
              <Pressable
                key={key}
                onPress={() => {
                  const eligible = (slots ?? [])
                    .filter((s) => s.start === slot.start)
                    .map((s) => s.coach_id);
                  onSelectSlot(slot, Array.from(new Set(eligible)));
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${formatSlotTime(slot.start, tz)}${isFull ? ', full — join waitlist' : ''}`}
                style={({ pressed }) => [
                  styles.slot,
                  selected && styles.slotSelected,
                  isFull && styles.slotFull,
                  pressed && !selected && styles.slotPressed,
                ]}
              >
                <Text
                  style={[
                    styles.slotTime,
                    selected && styles.slotTimeSelected,
                    isFull && styles.slotTimeFull,
                  ]}
                >
                  {formatSlotTime(slot.start, tz)}
                </Text>
                {capLabel ? (
                  <Text
                    style={[
                      styles.slotCap,
                      selected && styles.slotCapSelected,
                      isFull && styles.slotCapFull,
                    ]}
                  >
                    {capLabel}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 80,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  state: {
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
  },
  errorText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
  },
  emptyText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  slot: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
    minWidth: 92,
    alignItems: 'center',
  },
  slotSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  slotFull: {
    borderColor: colors.border,
    backgroundColor: 'rgba(155,149,144,0.06)',
  },
  slotPressed: {
    backgroundColor: 'rgba(241, 229, 173, 0.18)',
  },
  slotTime: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
  },
  slotTimeSelected: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
  },
  slotTimeFull: {
    color: colors.textMuted,
  },
  slotCap: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    marginTop: 1,
  },
  slotCapSelected: {
    color: colors.darkest,
  },
  slotCapFull: {
    color: colors.textMuted,
  },
});
