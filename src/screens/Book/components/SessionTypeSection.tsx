import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import { useSessionTypes } from '../hooks/useSessionTypes';
import SectionCard from './SectionCard';
import SessionTypeCard from './SessionTypeCard';

type Props = {
  selectedSessionTypeId: string | null;
  onSelect: (id: string) => void;
};

export default function SessionTypeSection({
  selectedSessionTypeId,
  onSelect,
}: Props) {
  const { data, isPending, isError, refetch, isRefetching } = useSessionTypes();

  return (
    <SectionCard title="Session Type" subtitle="Choose what you want to book.">
      {isPending ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
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
      ) : !data || data.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.emptyText}>No sessions available.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {data.map((s) => (
            <SessionTypeCard
              key={s.id}
              name={s.name}
              durationMinutes={s.duration_minutes}
              basePriceCents={s.base_price_cents}
              selected={selectedSessionTypeId === s.id}
              onPress={() => onSelect(s.id)}
            />
          ))}
        </View>
      )}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  list: {
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
