import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import { useSessionTypes } from '../hooks/useSessionTypes';
import SessionTypeCard from './SessionTypeCard';

type Props = {
  selectedSessionTypeId: string | null;
  onSelect: (id: string) => void;
  categoryFilter?: 'all' | 'private' | 'group' | 'cage';
};

export default function SessionTypeSection({
  selectedSessionTypeId,
  onSelect,
  categoryFilter = 'all',
}: Props) {
  const { data: raw, isPending, isError, refetch, isRefetching } = useSessionTypes();
  const data =
    categoryFilter === 'all' || !raw
      ? raw
      : raw.filter((s) => s.type_category === categoryFilter);

  if (isPending) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.state}>
        <Text style={styles.errorText}>
          Couldn&apos;t load sessions. Pull down to try again.
        </Text>
        <Text
          style={styles.retry}
          onPress={() => {
            if (!isRefetching) void refetch();
          }}
        >
          {isRefetching ? 'Retrying…' : 'Tap to retry'}
        </Text>
      </View>
    );
  }

  if (!data || data.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.emptyText}>No sessions available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {data.map((s) => (
        <SessionTypeCard
          key={s.id}
          name={s.name}
          durationMinutes={s.duration_minutes}
          basePriceCents={s.base_price_cents}
          typeCategory={s.type_category ?? 'private'}
          selected={selectedSessionTypeId === s.id}
          onPress={() => onSelect(s.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.lg,
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
  },
});
