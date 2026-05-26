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
 *
 * Sender identity is anonymised to "Infinite Hitting" per brand guidelines.
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
} from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'MessageThread'>['navigation'];
type Route = WorkStackScreenProps<'MessageThread'>['route'];

const POSTER_WIDTH = 480;
const SENDER_NAME = 'Infinite Hitting';

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
            {SENDER_NAME.toUpperCase()}
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
        <EmptyState onCompose={onComposeNew} />
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
                navigation.navigate('VideoPlayback', { messageId })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function EmptyState({ onCompose }: { onCompose: () => void }) {
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
        SEND A CLIP TO {SENDER_NAME.toUpperCase()}
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
      {/* Sender badge */}
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
            {isSelf ? 'YOU' : SENDER_NAME.toUpperCase()}
          </Text>
        </View>
        {time ? (
          <Text
            style={{
              fontFamily: fontFamilies.interRegular,
              fontSize: 10,
              color: colors.textMuted,
            }}
          >
            {time}
          </Text>
        ) : null}
      </View>

      {message.video?.muxPlaybackId ? (
        <Pressable
          onPress={() => onPlayCoachVideo(message.id)}
          style={({ pressed }) => [
            {
              borderRadius: radius['2xl'],
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor,
              width: 240,
              aspectRatio: 16 / 9,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Image
            source={{ uri: muxPosterUrl(message.video.muxPlaybackId) }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.32)',
            }}
          >
            <PlayCircle size={44} color={colors.gold} />
          </View>
        </Pressable>
      ) : message.video ? (
        <View
          style={{
            borderRadius: radius['2xl'],
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor,
            width: 240,
            aspectRatio: 16 / 9,
            backgroundColor: colors.dark,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: 16,
          }}
        >
          <PlayCircle size={32} color={colors.textMuted} />
          <Text
            style={{
              fontFamily: fontFamilies.interRegular,
              fontSize: fontSizes.sm,
              color: colors.textMuted,
              textAlign: 'center',
            }}
          >
            Still processing…
          </Text>
        </View>
      ) : (
        <View
          style={{
            borderRadius: radius['2xl'],
            borderWidth: 1.5,
            borderColor,
            backgroundColor: bg,
            paddingHorizontal: spacing['2xl'],
            paddingVertical: spacing.lg,
            maxWidth: 280,
          }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.interRegular,
              fontSize: fontSizes.base,
              color: fg,
              lineHeight: 22,
            }}
          >
            {message.messageText ?? ''}
          </Text>
        </View>
      )}
    </View>
  );
}

// Keep StyleSheet import for absoluteFillObject in Bubble
import { StyleSheet } from 'react-native';

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
