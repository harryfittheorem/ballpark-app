/**
 * AssignmentDetailScreen — parent-side detail for a single drill.
 *
 * States:
 *   pending   → "Mark as done" button calls completeAssignment, then
 *               renders an inline success Alert with the points credited.
 *   submitted → "Submitted, waiting on coach" pill.
 *   reviewed  → coach rating (1–5 stars) + feedback shown.
 *
 * Drill video playback uses expo-av's <Video /> with native controls,
 * the same pattern as v0.4 VideoPlaybackScreen. The Mux HLS URL is
 * `https://stream.mux.com/{playback_id}.m3u8`. While Mux is still
 * processing the asset (status != 'ready' or no playback id) we render
 * a "Drill video processing…" placeholder.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import { CheckCircle2, Clock, Coins, Star } from 'lucide-react-native';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useAssignment } from '@/hooks/useAssignment';
import { useCompleteAssignment } from '@/hooks/useCompleteAssignment';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Route = WorkStackScreenProps<'AssignmentDetail'>['route'];
type Nav = WorkStackScreenProps<'AssignmentDetail'>['navigation'];

function muxHlsUrl(playbackId: string) {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function formatDue(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function AssignmentDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { assignmentId } = route.params;

  const { data: assignment, isPending, isError, error } = useAssignment(assignmentId);
  const complete = useCompleteAssignment();

  const handleComplete = async () => {
    if (!assignment) return;
    try {
      const res = await complete.mutateAsync({
        assignmentId: assignment.id,
        kidId: assignment.kid_id,
      });
      Alert.alert(
        'Nice work!',
        `You earned ${res.pointsCredited} points. New balance: ${res.newBalance.toLocaleString()} pts.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch {
      // Surfaced via complete.error below.
    }
  };

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !assignment) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Drill not found</Text>
          {isError ? <Text style={styles.muted}>{errorMessage(error)}</Text> : null}
          <View style={{ height: spacing['3xl'] }} />
          <Button label="Back" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const due = formatDue(assignment.due_date);
  const drillVideo = assignment.drill_video;
  const drillReady = drillVideo?.status === 'ready' && !!drillVideo.mux_playback_id;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {drillVideo ? (
          <View style={styles.videoWrap}>
            {drillReady ? (
              <Video
                source={{ uri: muxHlsUrl(drillVideo.mux_playback_id as string) }}
                style={StyleSheet.absoluteFillObject}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            ) : (
              <Text style={styles.processingText}>Drill video processing…</Text>
            )}
          </View>
        ) : null}

        <Text style={styles.title}>{assignment.title}</Text>

        <View style={styles.metaRow}>
          {assignment.duration_estimate_minutes != null ? (
            <View style={styles.metaPill}>
              <Clock size={12} color={colors.gold} />
              <Text style={styles.metaText}>{assignment.duration_estimate_minutes} min</Text>
            </View>
          ) : null}
          {due ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>Due {due}</Text>
            </View>
          ) : null}
          <View style={styles.metaPill}>
            <Coins size={12} color={colors.gold} />
            <Text style={styles.metaText}>+{assignment.point_reward} pts</Text>
          </View>
        </View>

        {assignment.description ? (
          <Text style={styles.description}>{assignment.description}</Text>
        ) : null}

        {assignment.status === 'submitted' ? (
          <View style={styles.statusBanner}>
            <Clock size={18} color={colors.gold} />
            <Text style={styles.statusText}>Submitted — waiting on coach to review</Text>
          </View>
        ) : null}

        {assignment.status === 'reviewed' ? (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <CheckCircle2 size={20} color={colors.gold} />
              <Text style={styles.reviewHeaderText}>Reviewed by your coach</Text>
            </View>
            {assignment.rating != null ? (
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={20}
                    color={colors.gold}
                    fill={n <= (assignment.rating ?? 0) ? colors.gold : 'transparent'}
                  />
                ))}
              </View>
            ) : null}
            {assignment.feedback ? (
              <Text style={styles.feedback}>“{assignment.feedback}”</Text>
            ) : null}
          </View>
        ) : null}

        {complete.error ? (
          <Text style={styles.errorMsg}>{errorMessage(complete.error)}</Text>
        ) : null}

        {assignment.status === 'pending' ? (
          <View style={styles.actions}>
            <Button
              label="Mark as done"
              onPress={handleComplete}
              loading={complete.isPending}
              fullWidth
            />
            <Button
              label="Back"
              variant="secondary"
              onPress={() => navigation.goBack()}
              fullWidth
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  muted: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  errorMsg: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.danger,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  videoWrap: {
    aspectRatio: 16 / 9,
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  processingText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textLight,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  description: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: fontSizes.md * 1.5,
    marginBottom: spacing['2xl'],
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing['2xl'],
  },
  statusText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    flex: 1,
  },
  reviewCard: {
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing['2xl'],
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  reviewHeaderText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  starsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  feedback: {
    fontFamily: fontFamilies.interRegular,
    fontStyle: 'italic',
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: fontSizes.md * 1.5,
  },
  actions: {
    gap: spacing.lg,
    marginTop: spacing['2xl'],
  },
});
