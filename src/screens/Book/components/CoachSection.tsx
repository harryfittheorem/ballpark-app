import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import { useCoaches } from '../hooks/useCoaches';
import CoachCard from './CoachCard';
import SectionCard from './SectionCard';

type Props = {
  locked: boolean;
  lockedHint?: string;
  autoSelectedCoachId: string | null;
  eligibleCoachIds: string[];
  selectedCoachId: string | null;
  onSelectCoach: (coachId: string) => void;
};

export default function CoachSection({
  locked,
  lockedHint,
  autoSelectedCoachId,
  eligibleCoachIds,
  selectedCoachId,
  onSelectCoach,
}: Props) {
  const coaches = useCoaches();
  const findCoach = (id: string) =>
    coaches.data?.find((c) => c.id === id) ?? null;
  const autoCoach = autoSelectedCoachId ? findCoach(autoSelectedCoachId) : null;

  const renderBody = () => {
    if (locked) {
      return (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Available coaches will appear here.
          </Text>
        </View>
      );
    }

    if (coaches.isPending) {
      return (
        <View style={styles.state}>
          <ActivityIndicator color={colors.gold} />
        </View>
      );
    }

    if (coaches.isError) {
      return (
        <View style={styles.state}>
          <Text style={styles.errorText}>Couldn&apos;t load coaches.</Text>
          <Text
            style={styles.retry}
            onPress={() => {
              if (!coaches.isRefetching) void coaches.refetch();
            }}
          >
            {coaches.isRefetching ? 'Retrying…' : 'Tap to retry'}
          </Text>
        </View>
      );
    }

    if (autoCoach) {
      return (
        <CoachCard
          firstName={autoCoach.first_name}
          lastName={autoCoach.last_name}
          avatarUrl={autoCoach.avatar_url}
          specialty={autoCoach.specialty}
          bio={autoCoach.bio}
          readOnly
        />
      );
    }

    // Intersect eligible IDs with the resolved coach rows; if the intersection
    // is empty (no eligible coach, or every eligible ID failed to resolve to
    // an active coach in the cache), show the defensive empty state.
    const visibleCoaches = eligibleCoachIds
      .map((id) => findCoach(id))
      .filter((c): c is NonNullable<ReturnType<typeof findCoach>> => c !== null);

    if (visibleCoaches.length === 0) {
      return (
        <View style={styles.state}>
          <Text style={styles.emptyText}>
            No coaches available for this slot.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.list}>
        {visibleCoaches.map((coach) => (
          <CoachCard
            key={coach.id}
            firstName={coach.first_name}
            lastName={coach.last_name}
            avatarUrl={coach.avatar_url}
            specialty={coach.specialty}
            bio={coach.bio}
            selected={coach.id === selectedCoachId}
            onPress={() => onSelectCoach(coach.id)}
          />
        ))}
      </View>
    );
  };

  return (
    <SectionCard
      title="Coach"
      locked={locked}
      lockedHint={locked ? lockedHint : undefined}
    >
      {renderBody()}
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
  list: {
    gap: spacing.lg,
  },
});
