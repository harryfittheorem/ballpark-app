/**
 * MessageThreadScreen — v0.7 task #120.
 *
 * Bidirectional thread for one (kid, coach) pair. Renders text + video
 * bubbles with sender side decided by `senderUserId === self`. Tapping a
 * coach->parent video opens the existing full-screen Mux player on the
 * Home stack (avoids duplicating player chrome). Tapping a parent->coach
 * video plays inline via expo-av in a modal-ish overlay (out of scope for
 * v0.7 — currently shows a "still processing" placeholder until we wire
 * the parent-side full-screen player in a follow-up).
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, MessageCircle, PlayCircle, Send } from 'lucide-react-native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ThreadMessage } from '@/api/parentMessages';
import { useAuth } from '@/hooks/useAuth';
import {
  useMessageThread,
  useTenantCoachesForParent,
} from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'MessageThread'>['navigation'];
type Route = WorkStackScreenProps<'MessageThread'>['route'];

const POSTER_WIDTH = 480;

function muxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

export default function MessageThreadScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { kidId, coachUserId } = route.params;
  const { user } = useAuth();

  const { data: messages, isPending, isError, error, refetch } = useMessageThread(
    kidId,
    coachUserId,
  );
  const { data: coaches } = useTenantCoachesForParent();
  const coach = coaches?.find((c) => c.userId === coachUserId);
  const coachName =
    coach && (coach.firstName || coach.lastName)
      ? [coach.firstName, coach.lastName].filter(Boolean).join(' ')
      : 'Your coach';

  const data = useMemo(() => messages ?? [], [messages]);

  const onComposeNew = () =>
    navigation.navigate('SendVideoToCoach', { coachUserId });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.darkest }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing['3xl'],
          paddingVertical: spacing['2xl'],
          borderBottomWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: spacing['2xl'] }}>
          <Text
            numberOfLines={1}
            style={{
              color: colors.textOnDark,
              fontFamily: fontFamilies.oswaldBold,
              fontSize: fontSizes.xl,
              letterSpacing: tracking.wide,
              textAlign: 'center',
            }}
          >
            {coachName.toUpperCase()}
          </Text>
        </View>
        <Pressable onPress={onComposeNew} hitSlop={12}>
          <Send size={20} color={colors.gold} />
        </Pressable>
      </View>

      {isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] }}>
          <Text style={{ color: colors.danger, fontFamily: fontFamilies.interMedium }}>
            {errorMessage(error)}
          </Text>
          <Pressable onPress={() => refetch()} style={{ marginTop: spacing['2xl'] }}>
            <Text style={{ color: colors.gold, fontFamily: fontFamilies.oswaldBold }}>RETRY</Text>
          </Pressable>
        </View>
      ) : data.length === 0 ? (
        <EmptyState onCompose={onComposeNew} coachName={coachName} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing['3xl'], gap: spacing['2xl'] }}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              isSelf={!!user && item.senderUserId === user.id}
              onPlayCoachVideo={(messageId) =>
                navigation.navigate('Home', {
                  screen: 'VideoPlayback',
                  params: { messageId },
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ coachName, onCompose }: { coachName: string; onCompose: () => void }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing['4xl'],
        gap: spacing['3xl'],
      }}
    >
      <MessageCircle size={48} color={colors.goldDeep} />
      <Text
        style={{
          color: colors.textOnDark,
          fontFamily: fontFamilies.oswaldBold,
          fontSize: fontSizes['2xl'],
          letterSpacing: tracking.wide,
          textAlign: 'center',
        }}
      >
        SAY HI TO {coachName.toUpperCase()}
      </Text>
      <Text
        style={{
          color: colors.textLight,
          fontFamily: fontFamilies.interRegular,
          fontSize: fontSizes.lg,
          textAlign: 'center',
        }}
      >
        Send a quick clip — game footage, a swing check, or a question.
      </Text>
      <Pressable
        onPress={onCompose}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.base,
            backgroundColor: colors.gold,
            paddingVertical: spacing['3xl'],
            paddingHorizontal: spacing['5xl'],
            borderRadius: radius['2xl'],
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Send size={18} color={colors.dark} />
        <Text
          style={{
            color: colors.dark,
            fontFamily: fontFamilies.oswaldBold,
            fontSize: fontSizes.lg,
            letterSpacing: tracking.wider,
          }}
        >
          SEND A CLIP
        </Text>
      </Pressable>
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

  const created = new Date(message.createdAt);
  const time = Number.isNaN(created.getTime()) ? '' : formatSentRelative(created);

  return (
    <View style={{ alignItems: align, maxWidth: '88%', alignSelf: align }}>
      {/* Side badge (COACH for inbound, YOU for self) — keeps direction
          unambiguous even when both bubbles are gold-on-dark in dark mode. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 4,
          marginHorizontal: 6,
          gap: 8,
        }}
      >
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 4,
            backgroundColor: isSelf ? colors.gold : colors.goldDeep,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.oswaldBold,
              fontSize: 10,
              letterSpacing: tracking.wider,
              color: isSelf ? colors.dark : colors.darkest,
            }}
          >
            {isSelf ? 'YOU' : 'COACH'}
          </Text>
        </View>
        {message.senderDisplay && isSelf ? (
          <Text
            style={{
              fontFamily: fontFamilies.interMedium,
              fontSize: fontSizes.sm,
              color: colors.textLight,
            }}
          >
            From {message.senderDisplay}
          </Text>
        ) : null}
      </View>
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
          <VideoBubbleBody
            video={message.video}
            isSelf={isSelf}
            onPlay={() => {
              if (!isSelf) onPlayCoachVideo(message.id);
            }}
          />
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
          <Text style={{ color: fg, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.lg }}>
            {message.messageText}
          </Text>
        ) : null}
      </View>
      <Text
        style={{
          color: colors.textLight,
          fontFamily: fontFamilies.interRegular,
          fontSize: fontSizes.xs,
          marginTop: 4,
          marginHorizontal: 6,
        }}
      >
        Sent {time}
      </Text>
    </View>
  );
}

function formatSentRelative(d: Date): string {
  const now = Date.now();
  const diffMs = now - d.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (diffMs < oneDay && new Date(now).getDate() === d.getDate()) {
    return `today at ${time}`;
  }
  if (diffMs < 2 * oneDay) {
    return `yesterday at ${time}`;
  }
  if (diffMs < 7 * oneDay) {
    return d.toLocaleDateString(undefined, { weekday: 'long' }) + ` at ${time}`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${time}`;
}

function VideoBubbleBody({
  video,
  isSelf,
  onPlay,
}: {
  video: NonNullable<ThreadMessage['video']>;
  isSelf: boolean;
  onPlay: () => void;
}) {
  const ready = video.status === 'ready' && !!video.muxPlaybackId;
  return (
    <Pressable
      onPress={ready && !isSelf ? onPlay : undefined}
      disabled={!ready || isSelf}
      style={{
        width: 240,
        aspectRatio: 16 / 9,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: colors.darker,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {ready ? (
        <Image
          source={{ uri: muxPosterUrl(video.muxPlaybackId as string) }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <Text style={{ color: colors.textLight, fontFamily: fontFamilies.interMedium }}>
          {video.status === 'errored' ? 'Upload failed' : 'Processing video…'}
        </Text>
      )}
      {ready ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayCircle size={36} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}
