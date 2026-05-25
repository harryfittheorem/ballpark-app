import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, MessageCircle, PlayCircle, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createMuxUpload } from '@/api/mux';
import type { ThreadMessage } from '@/api/parentMessages';
import { useToast } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import {
  useMessageThread,
  useParentInbox,
  useSendParentMessage,
  useTenantCoachesForParent,
} from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';
import { uploadVideoToMux } from '@/utils/uploadVideo';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

const POSTER_WIDTH = 480;
const muxPoster = (id: string) =>
  `https://image.mux.com/${id}/thumbnail.jpg?width=${POSTER_WIDTH}`;

export default function MessagesBody() {
  const navigation = useNavigation<Nav>();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { family, kid } = useSelectedKid();

  const { data: coaches, isPending: coachesPending } = useTenantCoachesForParent();
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
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const idemKeyRef = useRef<string | null>(null);

  const activeCoach = useMemo(
    () => coaches?.find((c) => c.userId === coachUserId) ?? null,
    [coaches, coachUserId],
  );
  const coachName = useMemo(() => {
    if (!activeCoach) return 'Your coach';
    const n = [activeCoach.firstName, activeCoach.lastName].filter(Boolean).join(' ');
    return n || 'Your coach';
  }, [activeCoach]);

  const onPickAndSendVideo = useCallback(async () => {
    if (uploading) return;
    if (!kid || !family || !coachUserId) {
      showToast("Couldn't send — missing recipient.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showToast('Photo library permission is required to send a video.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setUploading(true);
    setUploadPct(0);
    try {
      if (!idemKeyRef.current) {
        idemKeyRef.current = `pmsg-${kid.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      const { upload_url, video_id } = await createMuxUpload(
        idemKeyRef.current,
        'parent_to_coach',
      );
      const { promise } = uploadVideoToMux({
        uploadUrl: upload_url,
        fileUri: asset.uri,
        contentType: asset.mimeType ?? 'video/mp4',
        onProgress: (f) => setUploadPct(Math.round(f * 100)),
      });
      await promise;
      await new Promise<void>((resolve, reject) => {
        sendMutation.mutate(
          {
            videoId: video_id,
            recipientFamilyId: family.id,
            recipientKidId: kid.id,
            recipientCoachUserId: coachUserId,
            label: null,
            senderDisplay: null,
            messageText: null,
          },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });
      idemKeyRef.current = null;
      showToast('Video sent — your coach will see it once it finishes processing.');
    } catch (err) {
      showToast(errorMessage(err));
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }, [uploading, kid, family, coachUserId, sendMutation, showToast]);

  // Navigate within the Work stack so pressing X returns here, not Home.
  const onPlayCoachVideo = (messageId: string) =>
    navigation.navigate('VideoPlayback', { messageId });

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

  // Keyboard avoidance is handled by the parent WorkScreen's
  // KeyboardAvoidingView, so this component is a plain View.
  return (
    <View style={styles.flex}>
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
        {coachesPending || (threadPending && !!coachUserId) ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : !coachUserId ? (
          <View style={styles.centered}>
            <MessageCircle size={36} color={colors.goldDeep} />
            <Text style={styles.emptyTitle}>NO COACH YET</Text>
            <Text style={styles.muted}>
              Your facility admin needs to configure a coach before you can start messaging.
            </Text>
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
          // inverted FlatList: index 0 renders at the bottom.
          // Data must be newest-first so the latest message sits at the bottom.
          <FlatList
            data={[...(messages ?? [])].reverse()}
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

      {uploading ? (
        <View style={styles.uploadBar}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.uploadText}>Uploading video… {uploadPct}%</Text>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable
          onPress={onPickAndSendVideo}
          disabled={uploading}
          style={({ pressed }) => [
            styles.iconBtn,
            uploading && { opacity: 0.4 },
            pressed && { opacity: 0.85 },
          ]}
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
    </View>
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
  uploadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    backgroundColor: colors.darker,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  uploadText: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
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
