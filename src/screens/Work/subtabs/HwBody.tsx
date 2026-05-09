import { useNavigation } from '@react-navigation/native';
import { ZapOff } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAssignments } from '@/hooks/useAssignments';
import { useFamily } from '@/hooks/useFamily';
import type { WorkStackScreenProps } from '@/navigation/types';
import AssignmentRow from '@/screens/Work/components/AssignmentRow';
import EmptyState from '@/screens/Videos/components/EmptyState';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

export default function HwBody() {
  const navigation = useNavigation<Nav>();
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  const { data: assignments } = useAssignments(kid?.id);
  const list = assignments ?? [];

  if (list.length === 0) {
    return (
      <EmptyState
        icon={<ZapOff size={26} color={colors.gold} />}
        title="No drills yet"
        body="When your coach assigns a drill it lands here with the video, your submission, and the feedback."
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      {list.map((a) => (
        <View key={a.id} style={styles.row}>
          <AssignmentRow
            assignment={a}
            onPress={() =>
              navigation.navigate('AssignmentDetail', { assignmentId: a.id })
            }
          />
          {a.status === 'reviewed' && a.feedback ? (
            <View style={styles.feedbackQuote}>
              <Text style={styles.feedbackText} numberOfLines={2}>
                &ldquo;{a.feedback}&rdquo;
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['6xl'] },
  row: { marginBottom: spacing.lg },
  feedbackQuote: {
    marginTop: spacing.xs,
    marginLeft: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
  },
  feedbackText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
  },
});
