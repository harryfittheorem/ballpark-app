import { useNavigation } from '@react-navigation/native';
import { Camera, MessageCircle, PlayCircle, Send } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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

import type { ThreadMessage } from '@/api/parentMessages';
import { useToast } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import {
  useMessageThread,
  useParentInbox,
  useSendParentMessage,
  useTenantCoachesForParent,
} from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

const POSTER_WIDTH = 480;
const muxPoster = (id: string) =>
  `https://image.mux.com/${id}/thumbnail.jpg?width=${POSTER_WIDTH}`;

export default function MessagesBody() {
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { family, kids } = useFamily();
  const kid = kids[0] ?? null;

  const { data: coaches } = useTenantCoachesForParent();
  const { data: inbox } = useParentInbox(kid?.id);

  const [coachUserId, setCoachUserId] = useState<string | null>(null);

  // Auto-select the right coach: the most recent inbox row that has any
  // history, else the only tenant coach, else the first coach. Re-runs
  // whenever the inputs change but only when the user hasn't explicitly
  // picked someone yet.
  useEffect(() => {
    if (coachUserId) return;
    const fromInbox = (inbox ?? []).find((r) => r.lastCreatedAt)?.coachUserId;
    if (fromInbox) {
      setCoachUserId(fromInbox);
      return;
    }
    if (coaches && coaches.length > 0) {
      setCoachUserId(coaches[0].userId);
    }
  }, [coachUserId, inbox, coaches]);

  const {
    data: messages,
    isPending: threadPending,
    isError: threadError,
    error: threadErrorObj,
    refetch: refetchThread,
  } = useMessageThread(kid?.id, coachUserId ?? undefined);

  const sendMutation = useSendParentMessage(
    kid && coachUserId ? { kidId: kid.id, coachUserId } : null,
  );

  const [draft, setDraft] = useState('');

  const activeCoach = useMemo(
    () => coaches?.find((c) => c.userId === coachUserId) ?? null,
    [coaches, coachUserId],
  );
  const coachName = useMemo(() => {
    if (!activeCoach) return 'Your coach';
    const n = [activeCoach.firstName, activeCoach.lastName].filter(Boolean).join(' ');
    return n || 'Your coach';
  }, [activeCoach]);

  const onOpenVideoComposer = () =>
    navigation.navigate('SendVideoToCoach', coachUserId ? { coachUserId } : undefined);

  const onPlayCoachVideo = (messageId: string) =>
    navigation.navigate('Home', { screen: 'VideoPlayback', params: { messageId } });

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    if (!kid || !family || !coachUserId) {
      showToast("Couldn't send — missing recipient.");
      return;
    }
    sendMutation.mutate(
      {
        videoId: null,
        recipientFamilyId: family.id,
        recipientKidId: kid.id,
        recipientCoachUserId: coachUserId,
        label: null,
        senderDisplay: null,
        messageText: text,
      },
      {
        onSuccess: () => {
          setDraft('');
        },
        onError: (err) => {
          showToast(errorMessage(err));
        },
      },
    );
  };

  if (!kid) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Add a kid to start messaging your coach.</Text>
      </View>
    );
  }

  const showCoachPicker = (coaches?.length ?? 0) > 1;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      {showCoachPicker ? (
        <View style={styles.pickerRow}>
          {coaches!.map((c) => {
            const active = c.userId === coachUserId;
            const label =
              [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Coach';
            return (
              <Pressable
                key={c.userId}
                onPress={() => setCoachUserId(c.userId)}
                style={[styles.pickerPill, active && styles.pickerPillActive]}
              >
                <Text
                  style={[styles.pickerPillText, active && styles.pickerPillTextActive]}
                >
                  {label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Text style={styles.headerName}>{coachName.toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.flex}>
        {threadPending || !coachUserId ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : threadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{errorMessage(threadErrorObj)}</Text>
            <Pressable onPress={() => refetchThread()}>
              <Text style={styles.retry}>RETRY</Text>
            </Pressable>
          </View>
        ) : (messages ?? []).length === 0 ? (
          <View style={styles.centered}>
            <MessageCircle size={36} color={colors.goldDeep} />
            <Text style={styles.emptyTitle}>SAY HI TO {coachName.toUpperCase()}</Text>
            <Text style={styles.muted}>
              Send a quick text or a video — game footage, a swing check, or a question.
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages ?? []}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.threadContent}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                isSelf={!!user && item.senderUserId === user.id}
                onPlayCoachVideo={onPlayCoachVideo}
              />
            )}
          />
        )}
      </View>

      <View style={styles.composer}>
        <Pressable
          onPress={onOpenVideoComposer}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Send a video"
        >
          <Camera size={20} color={colors.gold} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${coachName}…`}
          placeholderTextColor={colors.textMuted}
          multiline
          style={styles.input}
          editable={!sendMutation.isPending}
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim() || sendMutation.isPending || !coachUserId}
          style={({ pressed }) => [
            styles.sendBtn,
            (!draft.trim() || sendMutation.isPending || !coachUserId) && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Send size={18} color={colors.dark} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  message,
  isSelf,
  onPlayCoachVideo,
}: {
  message: ThreadMessage;
  isSelf: boolean;
  onPlayCoachVideo: (messageId: string) => void;
}) {
  const align = isSelf ? 'flex-end' : 'flex-start';
  const bg = isSelf ? colors.gold : colors.dark;
  const fg = isSelf ? colors.dark : colors.textOnDark;
  const borderColor = isSelf ? colors.gold : colors.borderGold;
  const ready = message.video?.status === 'ready' && !!message.video.muxPlaybackId;

  return (
    <View style={{ alignItems: align, maxWidth: '88%', alignSelf: align }}>
      <View
        style={{
          backgroundColor: bg,
          borderRadius: radius['2xl'],
          borderTopRightRadius: isSelf ? 4 : radius['2xl'],
          borderTopLeftRadius: !isSelf ? 4 : radius['2xl'],
          padding: spacing['2xl'],
          borderWidth: 1,
          borderColor,
          gap: spacing.base,
        }}
      >
        {message.video ? (
          <Pressable
            onPress={ready && !isSelf ? () => onPlayCoachVideo(message.id) : undefined}
            disabled={!ready || isSelf}
            style={styles.videoBubble}
          >
            {ready ? (
              <>
                <Image
                  source={{ uri: muxPoster(message.video.muxPlaybackId as string) }}
                  style={styles.videoImg}
                  resizeMode="cover"
                />
                <View style={styles.playOverlay}>
                  <PlayCircle size={36} color={colors.white} />
                </View>
              </>
            ) : (
              <Text style={[styles.muted, { color: colors.textLight }]}>
                {message.video.status === 'errored' ? 'Upload failed' : 'Processing video…'}
              </Text>
            )}
          </Pressable>
        ) : null}
        {message.label ? (
          <Text
            style={{
              fontFamily: fontFamilies.oswaldBold,
              fontSize: fontSizes.sm,
              letterSpacing: tracking.wider,
              color: isSelf ? colors.dark : colors.gold,
            }}
          >
            {message.label.replace(/_/g, ' ').toUpperCase()}
          </Text>
        ) : null}
        {message.messageText ? (
          <Text
            style={{ color: fg, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.lg }}
          >
            {message.messageText}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
    gap: spacing.lg,
  },
  muted: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    textAlign: 'center',
  },
  retry: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
    textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  pickerPill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  pickerPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pickerPillText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  pickerPillTextActive: { color: colors.dark },
  headerRow: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
  },
  threadContent: {
    padding: spacing['3xl'],
    gap: spacing['2xl'],
  },
  videoBubble: {
    width: 240,
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.darker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoImg: { width: '100%', height: '100%' },
  playOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.base,
    padding: spacing['2xl'],
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
  },
});
