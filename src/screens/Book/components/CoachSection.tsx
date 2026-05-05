import { StyleSheet, Text, View, Pressable } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import { useCoaches } from '../hooks/useCoaches';
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
  const { data: coaches } = useCoaches();
  const findCoach = (id: string) => coaches?.find((c) => c.id === id) ?? null;
  const autoCoach = autoSelectedCoachId ? findCoach(autoSelectedCoachId) : null;

  return (
    <SectionCard
      title="Coach"
      locked={locked}
      lockedHint={locked ? lockedHint : undefined}
    >
      {locked ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Available coaches will appear here.</Text>
        </View>
      ) : autoCoach ? (
        <View style={styles.autoCard}>
          <View style={styles.autoHeader}>
            <Text style={styles.autoBadge}>Auto-selected</Text>
          </View>
          <Text style={styles.coachName}>
            {autoCoach.first_name} {autoCoach.last_name}
          </Text>
          {autoCoach.specialty ? (
            <Text style={styles.specialty}>{autoCoach.specialty}</Text>
          ) : null}
        </View>
      ) : eligibleCoachIds.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Pick a time to choose a coach.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {eligibleCoachIds.map((id) => {
            const coach = findCoach(id);
            if (!coach) return null;
            const selected = id === selectedCoachId;
            return (
              <Pressable
                key={id}
                onPress={() => onSelectCoach(id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && !selected && styles.optionPressed,
                ]}
              >
                <Text style={[styles.optionName, selected && styles.optionNameSelected]}>
                  {coach.first_name} {coach.last_name}
                </Text>
                {coach.specialty ? (
                  <Text style={[styles.specialty, selected && styles.specialtySelected]}>
                    {coach.specialty}
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
  autoCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  autoHeader: {
    flexDirection: 'row',
  },
  autoBadge: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },
  coachName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  specialty: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
  },
  specialtySelected: {
    color: colors.darkest,
  },
  list: {
    gap: spacing.base,
  },
  option: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  optionPressed: {
    backgroundColor: 'rgba(241, 229, 173, 0.18)',
  },
  optionName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  optionNameSelected: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
  },
});
