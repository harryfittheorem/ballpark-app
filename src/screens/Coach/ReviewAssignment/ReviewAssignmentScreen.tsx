/**
 * ReviewAssignmentScreen — coach picks 1–5 stars + optional feedback,
 * calls `review_assignment` RPC. Disallowed unless status='submitted'.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui';
import { useAssignment } from '@/hooks/useAssignment';
import { useReviewAssignment } from '@/hooks/useReviewAssignment';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Route = CoachInboxStackScreenProps<'ReviewAssignment'>['route'];
type Nav = CoachInboxStackScreenProps<'ReviewAssignment'>['navigation'];

export default function ReviewAssignmentScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const { assignmentId } = route.params;

  const { data: assignment, isPending } = useAssignment(assignmentId);
  const review = useReviewAssignment();

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) return;
    try {
      await review.mutateAsync({
        assignmentId,
        rating,
        feedback: feedback.trim() === '' ? null : feedback.trim(),
      });
      showToast('Review sent');
      navigation.goBack();
    } catch {
      // Surfaced via review.error below.
    }
  };

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Drill not found</Text>
          <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const blocked = assignment.status !== 'submitted';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.eyebrow}>
            {assignment.kid ? `${assignment.kid.first_name} ${assignment.kid.last_name}` : 'Kid'}
          </Text>
          <Text style={styles.title}>{assignment.title}</Text>
          {assignment.description ? (
            <Text style={styles.description}>{assignment.description}</Text>
          ) : null}

          {blocked ? (
            <View style={styles.blockedCard}>
              <Text style={styles.blockedText}>
                This drill is {assignment.status} — only submitted drills can be reviewed.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = n <= rating;
                  return (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setRating(n)}
                      accessibilityRole="button"
                      accessibilityLabel={`${n} stars`}
                      style={styles.starButton}
                    >
                      <Star
                        size={36}
                        color={colors.gold}
                        fill={filled ? colors.gold : 'transparent'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Input
                label="Feedback (optional)"
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Great hip rotation — keep that tempo!"
                multiline
              />

              {review.error ? (
                <Text style={styles.errorMsg}>{errorMessage(review.error)}</Text>
              ) : null}

              <View style={styles.actions}>
                <Button
                  label="Send review"
                  onPress={handleSubmit}
                  loading={review.isPending}
                  disabled={rating < 1}
                  fullWidth
                />
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={() => navigation.goBack()}
                  fullWidth
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['6xl'] },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginBottom: spacing.lg,
  },
  description: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: fontSizes.md * 1.5,
    marginBottom: spacing['3xl'],
  },
  sectionLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  starButton: {
    padding: spacing.xs,
  },
  blockedCard: {
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blockedText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  errorMsg: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    marginVertical: spacing.lg,
    textAlign: 'center',
  },
  actions: { gap: spacing.lg, marginTop: spacing['2xl'] },
});
