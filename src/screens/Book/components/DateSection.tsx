import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { usePrimaryLocation } from '../hooks/usePrimaryLocation';
import { computeAvailableDates } from '../utils/availability';
import Calendar from './Calendar';
import SectionCard from './SectionCard';

type Props = {
  locked: boolean;
  durationMinutes: number | null;
  selectedDate: string | null;
  onSelectDate: (ymd: string) => void;
};

export default function DateSection({
  locked,
  durationMinutes,
  selectedDate,
  onSelectDate,
}: Props) {
  const availability = useCoachAvailability();
  const location = usePrimaryLocation();

  const computed = useMemo(() => {
    if (!availability.data || durationMinutes == null) return null;
    return computeAvailableDates({
      durationMinutes,
      rows: availability.data,
      timezone: location.data?.timezone ?? null,
      daysAhead: 30,
    });
  }, [availability.data, durationMinutes, location.data?.timezone]);

  // A disabled query (no primary_location_id on the family) reports
  // isPending=true forever; treat fetchStatus='idle' as "not loading" so the
  // calendar still renders using the device timezone fallback.
  const locationLoading =
    location.fetchStatus !== 'idle' && location.isPending && !location.data;
  const isPending = availability.isPending || locationLoading;
  const isError = availability.isError || location.isError;
  const isRefetching = availability.isRefetching || location.isRefetching;
  const retry = () => {
    if (availability.isError) void availability.refetch();
    if (location.isError) void location.refetch();
  };

  return (
    <SectionCard
      title="Date"
      locked={locked}
      lockedHint={locked ? 'Pick a session type first.' : undefined}
    >
      {locked ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Calendar will appear here.</Text>
        </View>
      ) : isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
        <View style={styles.state}>
          <Text style={styles.errorText}>
            Couldn&apos;t load availability.
          </Text>
          <Text
            style={styles.retry}
            onPress={() => {
              if (!isRefetching) retry();
            }}
          >
            {isRefetching ? 'Retrying…' : 'Tap to retry'}
          </Text>
        </View>
      ) : !computed || computed.availableDates.size === 0 ? (
        <View style={styles.state}>
          <Text style={styles.emptyText}>
            No dates available in the next 30 days.
          </Text>
        </View>
      ) : (
        <Calendar
          range={computed.range}
          today={computed.today}
          availableDates={computed.availableDates}
          selectedDate={selectedDate}
          onSelect={onSelectDate}
        />
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
});
