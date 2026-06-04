/**
 * CoachMessageThreadScreen — coach-side view of a (kid, coach) message thread.
 *
 * Uses useCoachMessageThread (not useMessageThread) which correctly fetches
 * BOTH directions of the conversation:
 *   - coach→parent: sender_user_id = coachUserId
 *   - parent→coach: recipient_coach_user_id = coachUserId
 *
 * The parent-side hook collapses when selfUserId === coachUserId, missing
 * parent→coach rows; this screen uses the dedicated coach-side query instead.
 *
 * Video bubbles navigate to CoachVideoPlayback (takes playbackId directly).
 * Text compose bar at the bottom lets coaches send text replies.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PlayCircle, Send } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachThreadMessage } from '@/api/coachInbox';
import { sendCoachTextReply } from '@/api/coachMessages';
import { coachInboxKeys, useCoachMessageThread } from '@/hooks/useCoachInbox';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = CoachInboxStackScreenProps<'CoachMessageThread'>['navigation'];
type Route = CoachInboxStackScreenProps<'CoachMessageThread'>['route'];

const POSTER_WIDTH = 480;

function muxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

function formatSentRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CoachMessageThreadScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { kidId, coachUserId, familyId, familyDisplayName } = route.params;

  const queryClient = useQueryClient();
  const { data: messages, isPending, isError, error, refetch } = useCoachMessageThread(
    kidId,
    coachUserId,
  );

  const data = useMemo(() => messages ?? [], [messages]);
  const flatListRef = useRef<FlatList>(null);

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  async function handleSend() {
    const text = replyText.trim();
    if (!text || sending) return;

    setSending(true);
    setSendError(null);
    try {
      await sendCoachTextReply({
        recipientFamilyId: familyId,
        recipientKidId: kidId,
        messageText: text,
      });
      setReplyText('');
      await queryClient.invalidateQueries({
        queryKey: coachInboxKeys.thread(kidId, coachUserId),
      });
      await queryClient.invalidateQueries({
        queryKey: coachInboxKeys.inbox(coachUserId),
      });
      // Scroll to bottom after data refreshes
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    } catch (e) {
      setSendError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.headerBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={22} color={colors.textOnDark} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {(familyDisplayName ?? 'Family').toUpperCase()}
            </Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        {/* Message list */}
        {isPending ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{errorMessage(error)}</Text>
            <Pressable onPress={() => refetch()} style={{ marginTop: spacing['2xl'] }}>
              <Text style={styles.retryText}>RETRY</Text>
            </Pressable>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No messages yet.</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={data}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            renderItem={({ item }) => (
              <Bubble
                message={item}
                coachUserId={coachUserId}
                onPlayVideo={(playbackId) =>
                  navigation.navigate('CoachVideoPlayback', { playbackId })
                }
              />
            )}
          />
        )}

        {/* Compose bar */}
        <View style={styles.composeArea}>
          {sendError ? (
            <Text style={styles.sendErrorText}>{sendError}</Text>
          ) : null}
          <View style={styles.composeRow}>
            <TextInput
              style={styles.input}
              placeholder="Type a reply…"
              placeholderTextColor={colors.textMuted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <Pressable
              onPress={handleSend}
              disabled={sending || !replyText.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                (!replyText.trim() || sending) && styles.sendBtnDisabled,
                pressed && styles.sendBtnPressed,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.dark} />
              ) : (
                <Send size={18} color={replyText.trim() ? colors.dark : colors.textMuted} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({
  message,
  coachUserId,
  onPlayVideo,
}: {
  message: CoachThreadMessage;
  coachUserId: string;
  onPlayVideo: (playbackId: string) => void;
}) {
  const isSelf = message.senderUserId === coachUserId;
  const align = isSelf ? 'flex-end' : 'flex-start';
  const bg = isSelf ? colors.gold : colors.dark;
  const fg = isSelf ? colors.dark : colors.textOnDark;
  const borderColor = isSelf ? colors.gold : colors.borderGold;

  const created = new Date(message.createdAt);
  const time = Number.isNaN(created.getTime()) ? '' : formatSentRelative(created);

  return (
    <View style={{ alignItems: align, maxWidth: '88%', alignSelf: align }}>
      <View style={styles.senderBadgeRow}>
        <View
          style={[
            styles.senderBadge,
            { backgroundColor: isSelf ? colors.gold : colors.goldDeep },
          ]}
        >
          <Text
            style={[
              styles.senderBadgeText,
              { color: isSelf ? colors.dark : colors.darkest },
            ]}
          >
            {isSelf ? 'YOU' : 'FAMILY'}
          </Text>
        </View>
        {time ? <Text style={styles.timeText}>{time}</Text> : null}
      </View>

      {message.video?.muxPlaybackId ? (
        <Pressable
          onPress={() => onPlayVideo(message.video!.muxPlaybackId!)}
          style={({ pressed }) => [styles.videoBubble, { borderColor }, pressed && { opacity: 0.85 }]}
        >
          <Image
            source={{ uri: muxPosterUrl(message.video.muxPlaybackId) }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={styles.playOverlay}>
            <PlayCircle size={44} color={colors.gold} />
          </View>
        </Pressable>
      ) : message.video ? (
        <View style={[styles.videoBubble, { borderColor, backgroundColor: colors.dark }]}>
          <PlayCircle size={32} color={colors.textMuted} />
          <Text style={styles.processingText}>Still processing…</Text>
        </View>
      ) : (
        <View
          style={[
            styles.textBubble,
            { borderColor, backgroundColor: bg },
          ]}
        >
          <Text style={[styles.textBubbleContent, { color: fg }]}>
            {message.messageText ?? ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.darkest },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerCenter: { flex: 1, marginHorizontal: spacing['2xl'] },
  headerTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  retryText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wide,
  },
  emptyText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  list: {
    padding: spacing['3xl'],
    gap: spacing['2xl'],
  },
  senderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginHorizontal: 6,
    gap: 8,
  },
  senderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  senderBadgeText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: 10,
    letterSpacing: tracking.wider,
  },
  timeText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: 10,
    color: colors.textMuted,
  },
  videoBubble: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1.5,
    width: 240,
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  processingText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  textBubble: {
    borderRadius: radius['2xl'],
    borderWidth: 1.5,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    maxWidth: 280,
  },
  textBubbleContent: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    lineHeight: 22,
  },
  composeArea: {
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darkest,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  sendErrorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginBottom: spacing.base,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    backgroundColor: colors.dark,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.darker,
  },
  sendBtnPressed: {
    opacity: 0.8,
  },
});
