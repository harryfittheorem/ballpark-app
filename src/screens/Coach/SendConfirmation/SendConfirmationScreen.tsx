/**
 * SendConfirmationScreen — v0.4 Step 4.10.
 *
 * Final step of the coach send flow. The coach lands here from the Recipient
 * Picker with `{ videoId, recipientFamilyId, recipientKidId }` in route
 * params. We:
 *   1. Show a summary card: Mux poster (or "Processing video…" placeholder
 *      while the webhook hasn't flipped status to `ready`), recipient name,
 *      and the coach's own name.
 *   2. Let the coach attach an optional note (multi-line input).
 *   3. On Send, INSERT a row into `public.coach_messages` via
 *      `useSendCoachMessage()`. RLS pins tenant + sender server-side; we
 *      still pass tenant_id explicitly because the policy's WITH CHECK
 *      requires it on the row itself.
 *
 * On success we toast and `popToTop()` back to the Coach landing. On error
 * we surface the message inline and re-enable Send while preserving the note
 * so the coach doesn't lose typing.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useCoach } from '@/hooks/useCoach';
import { useSendCoachMessage } from '@/hooks/useSendCoachMessage';
import { useTenantKids } from '@/hooks/useTenantKids';
import { useVideoPreview } from '@/hooks/useVideoPreview';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { useDraftNote, useDraftNotesStore } from '@/store/draftNotes';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/error';

import { styles } from './styles';

type Nav = CoachInboxStackScreenProps<'SendConfirmation'>['navigation'];
type Route = CoachInboxStackScreenProps<'SendConfirmation'>['route'];

const POSTER_WIDTH = 480;

function muxPosterUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

export default function SendConfirmationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { videoId, recipientFamilyId, recipientKidId } = route.params;

  const { firstName: coachFirstName, lastName: coachLastName } = useCoach();
  const { kids } = useTenantKids();
  const { showToast } = useToast();

  const recipient = useMemo(
    () => kids.find((k) => k.kidId === recipientKidId) ?? null,
    [kids, recipientKidId],
  );

  const videoQuery = useVideoPreview(videoId);
  const sendMutation = useSendCoachMessage();

  // Note text is kept in a Zustand slice keyed by videoId so navigating
  // back to the Recipient Picker (to fix the recipient) and returning here
  // does NOT lose what the coach already typed. Cleared on successful send.
  const [note, setNote] = useDraftNote(videoId);
  const clearDraft = useDraftNotesStore((s) => s.clearDraft);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canSend = !sendMutation.isPending;

  const handleSend = () => {
    setErrorText(null);
    const trimmed = note.trim();
    sendMutation.mutate(
      {
        videoId,
        recipientFamilyId,
        recipientKidId,
        messageText: trimmed.length > 0 ? trimmed : null,
      },
      {
        onSuccess: () => {
          clearDraft(videoId);
          const name = recipient?.firstName ?? 'the family';
          showToast(`Video sent to ${name}`);
          navigation.popToTop();
        },
        onError: (err) => {
          setErrorText(errorMessage(err));
        },
      },
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const recipientName = recipient
    ? `${recipient.firstName} ${recipient.lastName}`
    : 'Loading…';
  const familyLine = recipient ? `${recipient.familyLastName} Family` : '';
  const senderName =
    coachFirstName || coachLastName
      ? `${coachFirstName ?? ''} ${coachLastName ?? ''}`.trim()
      : 'You';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <VideoPosterArea
              status={videoQuery.data?.status ?? null}
              playbackId={videoQuery.data?.mux_playback_id ?? null}
              loading={videoQuery.isPending}
            />
            <View style={styles.cardBody}>
              <View>
                <Text style={styles.fieldLabel}>To</Text>
                <Text style={styles.fieldValue}>{recipientName}</Text>
                {familyLine ? (
                  <Text style={styles.fieldValueMuted}>{familyLine}</Text>
                ) : null}
              </View>
              <View>
                <Text style={styles.fieldLabel}>From</Text>
                <Text style={styles.fieldValue}>{senderName}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.noteLabel}>Add a note (optional)</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            maxLength={1000}
            placeholder="Say something to the family…"
            placeholderTextColor={colors.textMuted}
            editable={!sendMutation.isPending}
          />

          {errorText ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{errorText}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Send video"
            style={[
              styles.primaryBtn,
              !canSend && styles.primaryBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={colors.dark} />
            ) : (
              <Text style={styles.primaryBtnText}>Send</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.secondaryBtn}
            onPress={handleBack}
            disabled={sendMutation.isPending}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function VideoPosterArea({
  status,
  playbackId,
  loading,
}: {
  status: string | null;
  playbackId: string | null;
  loading: boolean;
}) {
  if (status === 'ready' && playbackId) {
    return (
      <Image
        source={{ uri: muxPosterUrl(playbackId) }}
        style={styles.poster}
        resizeMode="cover"
      />
    );
  }

  if (status === 'errored') {
    return (
      <View style={styles.posterPlaceholder}>
        <Text style={styles.posterErrorText}>
          Video processing failed. You can still send a note, or go back and
          re-upload.
        </Text>
      </View>
    );
  }

  // uploading / processing / unknown / loading
  return (
    <View style={styles.posterPlaceholder}>
      <ActivityIndicator color={colors.gold} />
      <Text style={styles.posterPlaceholderText}>
        {loading ? 'Loading preview…' : 'Processing video…'}
      </Text>
    </View>
  );
}
