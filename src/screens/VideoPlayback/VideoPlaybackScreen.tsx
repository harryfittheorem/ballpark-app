/**
 * Video Playback screen (v0.4 Step 4.13).
 *
 * Full-screen Mux HLS player for a single coach_message. The first time
 * playback actually starts we fire `markCoachMessageViewed` (idempotent,
 * column-restricted via the GRANT in Step 4.1) so the coach's Sent Videos
 * list (Step 4.11) flips the row to "Viewed" on next refresh. On unmount
 * we invalidate the Home "latest coach message" cache so the badge /
 * dot on the Home card refreshes immediately on the way back.
 *
 * Player choice: `expo-av`'s <Video /> with `useNativeControls` — gives
 * us a play/pause/scrubber chrome on both platforms with no custom UI.
 * Mux HLS URL is `https://stream.mux.com/{playback_id}.m3u8`.
 *
 * Audio: we deliberately do NOT call `Audio.setAudioModeAsync` —
 * expo-av's default respects the iOS silent switch, which is the polite
 * behavior for a kid/parent app. A "let it play through silent mode"
 * opt-in can land later if anyone asks for it.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResizeMode,
  Video,
  type AVPlaybackStatus,
} from 'expo-av';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markCoachMessageViewed } from '@/api/coachMessages';
import { useCoachMessage } from '@/hooks/useCoachMessage';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

type Route = HomeStackScreenProps<'VideoPlayback'>['route'];
type Nav = HomeStackScreenProps<'VideoPlayback'>['navigation'];

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function CloseButton({ onPress }: { onPress: () => void }) {
  // Absolute-positioned overlay so the player itself fills the entire
  // viewport behind it. SafeAreaView keeps the tap target clear of the
  // notch / status bar on both platforms.
  return (
    <SafeAreaView
      pointerEvents="box-none"
      style={styles.closeOverlay}
      edges={['top', 'left']}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Close video"
        hitSlop={12}
        style={({ pressed }) => [
          styles.closeButton,
          pressed && styles.closePressed,
        ]}
      >
        <X size={22} color={colors.gold} />
      </Pressable>
    </SafeAreaView>
  );
}

export default function VideoPlaybackScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { messageId } = route.params;

  const qc = useQueryClient();
  const { data: message, isPending, error } = useCoachMessage(messageId);

  // Guard so the mark-viewed mutation only fires once per mount, no matter
  // how many `onPlaybackStatusUpdate` ticks land before the network
  // round-trip completes.
  const markedRef = useRef(false);

  const markViewed = useMutation({
    mutationFn: () => markCoachMessageViewed(messageId),
    // Failures are swallowed deliberately — viewed_at is best-effort
    // analytics and shouldn't surface as a player error to the parent.
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.warn('markCoachMessageViewed failed:', errorMessage(err));
    },
  });

  // Invalidate the Home "latest coach message" cache on unmount so the
  // card on the way back reflects the new viewed_at. Prefix invalidation
  // covers every kid-keyed entry without us having to know which kid this
  // message belongs to from this screen's params.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: ['coachMessages', 'latest'] });
    };
  }, [qc]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (markedRef.current) return;
      if (!status.isLoaded) return;
      // Either a non-zero position or an active isPlaying flag is enough
      // to call this "playback started" — covers the case where the
      // first tick lands while the player is still buffering at 0ms.
      if (status.isPlaying || (status.positionMillis ?? 0) > 0) {
        markedRef.current = true;
        markViewed.mutate();
      }
    },
    [markViewed],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  if (isPending) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={colors.gold} />
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>Couldn&rsquo;t load video</Text>
        <Text style={styles.messageBody}>{errorMessage(error)}</Text>
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  if (!message) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>Video not found</Text>
        <Text style={styles.messageBody}>
          This message may have been removed.
        </Text>
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  const video = message.video;
  if (!video || video.status !== 'ready' || !video.muxPlaybackId) {
    const errored = video?.status === 'errored';
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>
          {errored ? 'This video couldn\u2019t be processed' : 'Still processing'}
        </Text>
        <Text style={styles.messageBody}>
          {errored
            ? 'Your coach will need to re-record and send this one again.'
            : 'This video is still processing \u2014 check back in a moment.'}
        </Text>
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Video
        style={styles.fill}
        source={{ uri: muxHlsUrl(video.muxPlaybackId) }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        onPlaybackStatusUpdate={onStatusUpdate}
      />
      <CloseButton onPress={goBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  closeButton: {
    margin: spacing.md,
    width: spacing['5xl'],
    height: spacing['5xl'],
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 14, 14, 0.6)',
  },
  closePressed: {
    opacity: 0.7,
  },
  messageWrap: {
    flex: 1,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.md,
  },
  messageTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    textAlign: 'center',
  },
  messageBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});
