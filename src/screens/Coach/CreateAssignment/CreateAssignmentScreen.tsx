/**
 * CreateAssignmentScreen — coach-side v0.6.
 *
 * Picks a kid (grouped by family, single-select), then collects the drill
 * details: title, description, duration, due date, point reward, and an
 * optional Mux drill video id forwarded from the prior RecordVideo flow
 * via route.params.drillVideoId.
 *
 * Submit calls `createAssignment`, which infers tenant_id from the
 * coach's row and pins the row to the JWT tenant. Success returns to the
 * Inbox home with a toast.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Video as VideoIcon, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAssignment } from '@/api/assignments';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui';
import { useCoach } from '@/hooks/useCoach';
import { useTenantKids } from '@/hooks/useTenantKids';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = CoachInboxStackScreenProps<'CreateAssignment'>['navigation'];
type Route = CoachInboxStackScreenProps<'CreateAssignment'>['route'];

const DEFAULT_POINTS = 25;

export default function CreateAssignmentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  // The drillVideoId is forwarded back to this screen by the
  // RecordVideo flow (navigation.replace with purpose='drill_assignment').
  // We hold it in local state so the coach can clear / re-record without
  // losing the rest of the form they typed.
  const [drillVideoId, setDrillVideoId] = useState<string | null>(
    route.params?.drillVideoId ?? null,
  );
  // When RecordVideo pops back with a new drillVideoId via navigate
  // (merge:true), this screen instance is reused, so the param flips
  // *under* our existing form state. Mirror it into local state so the
  // attached-pill renders without losing the title/notes the coach typed.
  useEffect(() => {
    if (route.params?.drillVideoId) {
      setDrillVideoId(route.params.drillVideoId);
    }
  }, [route.params?.drillVideoId]);
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { coach } = useCoach();
  const { kids, loading: kidsLoading } = useTenantKids();

  const [selectedKidId, setSelectedKidId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('15');
  const [dueDate, setDueDate] = useState(''); // YYYY-MM-DD
  const [points, setPoints] = useState(String(DEFAULT_POINTS));

  const sections = useMemo(() => {
    const byFamily = new Map<string, typeof kids>();
    for (const k of kids) {
      const arr = byFamily.get(k.familyId) ?? [];
      arr.push(k);
      byFamily.set(k.familyId, arr);
    }
    return Array.from(byFamily.entries()).map(([familyId, list]) => ({
      familyId,
      familyLastName: list[0]?.familyLastName ?? '',
      kids: list,
    }));
  }, [kids]);

  const selected = kids.find((k) => k.kidId === selectedKidId) ?? null;

  const create = useMutation({
    mutationFn: createAssignment,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['coachAssignments', coach?.tenant_id] });
      qc.invalidateQueries({ queryKey: ['assignments', row.kid_id] });
      showToast('Drill assigned');
      navigation.popToTop();
    },
  });

  const titleError = title.trim().length === 0 ? 'Title is required' : null;
  const kidError = !selectedKidId ? 'Pick a kid' : null;
  const pointsNum = Number.parseInt(points, 10);
  const pointsError =
    !Number.isFinite(pointsNum) || pointsNum < 0 || pointsNum > 1000
      ? 'Points must be 0–1000'
      : null;
  const durationNum = duration.trim() === '' ? null : Number.parseInt(duration, 10);
  const durationError =
    duration.trim() !== '' &&
    (!Number.isFinite(durationNum as number) || (durationNum as number) < 1 || (durationNum as number) > 240)
      ? 'Minutes must be 1–240'
      : null;
  const dueError =
    dueDate.trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
      ? 'Use YYYY-MM-DD'
      : null;

  const canSubmit =
    !titleError && !kidError && !pointsError && !durationError && !dueError && !create.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !selected) return;
    create.mutate({
      kidId: selected.kidId,
      familyId: selected.familyId,
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      drillVideoId,
      durationEstimateMinutes: durationNum,
      dueDate: dueDate.trim() === '' ? null : dueDate.trim(),
      pointReward: pointsNum,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Assign to</Text>
          {kidsLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : sections.length === 0 ? (
            <Text style={styles.muted}>No kids yet — ask the front desk to add some families.</Text>
          ) : (
            sections.map((s) => (
              <View key={s.familyId} style={styles.familyBlock}>
                <Text style={styles.familyHeader}>{s.familyLastName} Family</Text>
                <View style={styles.kidRow}>
                  {s.kids.map((k) => {
                    const active = k.kidId === selectedKidId;
                    return (
                      <TouchableOpacity
                        key={k.kidId}
                        onPress={() => setSelectedKidId(active ? null : k.kidId)}
                        style={[styles.chip, active && styles.chipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {k.firstName} {k.lastName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
          {kidError && selectedKidId === null ? (
            <Text style={styles.fieldError}>{kidError}</Text>
          ) : null}

          <View style={{ height: spacing['2xl'] }} />

          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 50 swings off the tee"
            required
            error={title.length > 0 ? titleError ?? undefined : undefined}
            maxLength={120}
          />
          <Input
            label="Coach notes"
            value={description}
            onChangeText={setDescription}
            placeholder="Focus on hip rotation, slow tempo to start."
            multiline
          />
          <Input
            label="Estimated minutes"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
            placeholder="15"
            error={durationError ?? undefined}
          />
          <Input
            label="Due date (YYYY-MM-DD)"
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="2026-05-12"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            error={dueError ?? undefined}
          />
          <Input
            label="Points reward"
            value={points}
            onChangeText={setPoints}
            keyboardType="number-pad"
            error={pointsError ?? undefined}
          />

          {drillVideoId ? (
            <View style={styles.attachedRow}>
              <View style={styles.attachedPill}>
                <VideoIcon size={14} color={colors.gold} />
                <Text style={styles.attachedText}>Drill video attached</Text>
              </View>
              <Pressable
                onPress={() => setDrillVideoId(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove drill video"
                style={styles.removeBtn}
                hitSlop={8}
              >
                <X size={14} color={colors.textLight} />
              </Pressable>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachBtn}
              onPress={() =>
                navigation.navigate('RecordVideo', { purpose: 'drill_assignment' })
              }
              accessibilityRole="button"
            >
              <VideoIcon size={16} color={colors.gold} />
              <Text style={styles.attachBtnText}>Attach drill video (optional)</Text>
            </TouchableOpacity>
          )}

          {create.error ? (
            <Text style={styles.fieldError}>{errorMessage(create.error)}</Text>
          ) : null}

          <View style={styles.actions}>
            <Button
              label="Assign drill"
              onPress={handleSubmit}
              loading={create.isPending}
              disabled={!canSubmit}
              fullWidth
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => navigation.goBack()}
              fullWidth
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['6xl'] },
  sectionLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  familyBlock: { marginBottom: spacing['2xl'] },
  familyHeader: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  kidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
  chipTextActive: { color: colors.darkest },
  fieldError: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  muted: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  attachedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.darker,
  },
  attachedText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderStyle: 'dashed',
    backgroundColor: colors.darker,
    marginBottom: spacing['2xl'],
  },
  attachBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  actions: { gap: spacing.lg, marginTop: spacing['2xl'] },
});
