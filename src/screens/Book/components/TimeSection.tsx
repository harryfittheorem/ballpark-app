import { Fragment, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoaches } from '../hooks/useCoaches';
import { useDayBookings } from '../hooks/useDayBookings';
import { usePrimaryLocation } from '../hooks/usePrimaryLocation';
import {
  formatSlotTime,
  generateDaySlots,
  uniqueCoachIds,
  type Slot,
} from '../utils/slots';
import SectionCard from './SectionCard';

type Props = {
  locked: boolean;
  lockedHint?: string;
  date: string | null;
  durationMinutes: number | null;
  selectedSlotKey: string | null;
  onSelectSlot: (slot: Slot, eligibleCoachIds: string[]) => void;
};

export default function TimeSection({
  locked,
  lockedHint,
  date,
  durationMinutes,
  selectedSlotKey,
  onSelectSlot,
}: Props) {
  const availability = useCoachAvailability();
  const location = usePrimaryLocation();
  const coaches = useCoaches();
  const bookings = useDayBookings(date, location.data?.timezone ?? null);

  const slots = useMemo<Slot[] | null>(() => {
    if (!date || durationMinutes == null || !availability.data || !bookings.data) {
      return null;
    }
    return generateDaySlots({
      date,
      durationMinutes,
      timezone: location.data?.timezone ?? null,
      availability: availability.data,
      bookings: bookings.data,
    });
  }, [date, durationMinutes, availability.data, bookings.data, location.data?.timezone]);

  // A disabled location query (no primary_location_id) reports
  // isPending=true forever; gate on fetchStatus so the time grid can still
  // render using the device timezone fallback.
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

  const coachNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of coaches.data ?? []) {
      map.set(c.id, `${c.first_name} ${c.last_name}`.trim());
    }
    return map;
  }, [coaches.data]);

  const grouped = useMemo(() => {
    if (!slots) return [];
    const ids = uniqueCoachIds(slots);
    return ids.map((coachId) => ({
      coachId,
      coachName: coachNames.get(coachId) ?? 'Coach',
      slots: slots.filter((s) => s.coach_id === coachId),
    }));
  }, [slots, coachNames]);

  const showCoachLabels = grouped.length > 1;
  const tz = location.data?.timezone ?? null;

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
      ) : !slots || slots.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.emptyText}>No times available — try another date.</Text>
        </View>
      ) : (
        <View style={styles.groups}>
          {grouped.map((g) => (
            <Fragment key={g.coachId}>
              {showCoachLabels ? (
                <Text style={styles.groupLabel}>{g.coachName}</Text>
              ) : null}
              <View style={styles.grid}>
                {g.slots.map((slot) => {
                  const key = `${slot.coach_id}|${slot.start}`;
                  const selected = key === selectedSlotKey;
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
                      accessibilityLabel={`${formatSlotTime(slot.start, tz)}${
                        showCoachLabels ? ` with ${g.coachName}` : ''
                      }`}
                      style={({ pressed }) => [
                        styles.slot,
                        selected && styles.slotSelected,
                        pressed && !selected && styles.slotPressed,
                      ]}
                    >
                      <Text
                        style={[styles.slotText, selected && styles.slotTextSelected]}
                      >
                        {formatSlotTime(slot.start, tz)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Fragment>
          ))}
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
  groups: {
    gap: spacing.lg,
  },
  groupLabel: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textOnDark,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
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
  slotPressed: {
    backgroundColor: 'rgba(241, 229, 173, 0.18)',
  },
  slotText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
  },
  slotTextSelected: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
  },
});
