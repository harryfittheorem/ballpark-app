/**
 * Video Playback screen (v0.4 Step 4.13).
 *
 * Full-screen Mux HLS player for a single coach_message. Registered in
 * both HomeStackNavigator and WorkStackNavigator so the X button always
 * returns to whichever tab the user came from (goBack within the current
 * stack, not a cross-tab navigate).
 *
 * Fixes applied in Task #200:
 *   - `key={messageId}` on <Video> forces a fresh AVPlayer mount each
 *     time the screen opens, eliminating the black-screen-on-second-play
 *     caused by the native layer not resetting.
 *   - `isBuffering` state drives an ActivityIndicator overlay while the
 *     HLS stream is loading, so the user sees a spinner instead of a
 *     blank black screen.
 *   - When the video is still processing, `refetchInterval` polls Supabase
 *     every 3 s and the UI shows "Getting video ready…" with a spinner
 *     rather than a dead-end error — it auto-transitions to the player
 *     once the status flips to 'ready'.
 *
 * Player choice: `expo-av`'s <Video /> with `useNativeControls`.
 * Audio: we deliberately do NOT call `Audio.setAudioModeAsync` —
 * expo-av's default respects the iOS silent switch.
 */

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResizeMode,
  Video,
  type AVPlaybackStatus,
} from 'expo-av';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

// Generic param type — works whether this screen is mounted in HomeStack
// or WorkStack (both define VideoPlayback: { messageId: string }).
type VideoPlaybackParams = { messageId: string };
type Route = RouteProp<{ VideoPlayback: VideoPlaybackParams }, 'VideoPlayback'>;

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function CloseButton({ onPress }: { onPress: () => void }) {
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
  // useNavigation without a generic — we only need goBack() / canGoBack(),
  // which exist on every navigation object regardless of stack.
  const navigation = useNavigation();
  const { messageId } = route.params;

  const qc = useQueryClient();

  // Poll every 3 s while the video is still processing so the screen
  // auto-advances to the player without the user having to navigate away
  // and back.
  const { data: message, isPending, error } = useCoachMessage(messageId, {
    refetchInterval: (query) => {
      const d = query.state.data as { video?: { status?: string } | null } | null | undefined;
      if (!d || !d.video || d.video.status === 'processing') return 3000;
      return false;
    },
  });

  // Track native player buffering state so we can show a spinner overlay.
  const [isBuffering, setIsBuffering] = useState(true);

  // Guard so the mark-viewed mutation only fires once per mount.
  const markedRef = useRef(false);

  const markViewed = useMutation({
    mutationFn: () => markCoachMessageViewed(messageId),
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.warn('markCoachMessageViewed failed:', errorMessage(err));
    },
  });

  // Invalidate the Home "latest coach message" cache on unmount.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: ['coachMessages', 'latest'] });
    };
  }, [qc]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      // Update buffering overlay: hide once the player is loaded and not buffering.
      if (status.isLoaded) {
        setIsBuffering(status.isBuffering);
      }

      // Mark-viewed guard (fires at most once per mount).
      if (markedRef.current) return;
      if (!status.isLoaded) return;
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

  // Video errored — permanent dead end.
  if (video?.status === 'errored') {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>This video couldn&rsquo;t be processed</Text>
        <Text style={styles.messageBody}>
          Your coach will need to re-record and send this one again.
        </Text>
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  // Video is still processing — show a spinner and let the refetchInterval
  // above poll until status becomes 'ready', then the component re-renders
  // into the player branch automatically.
  if (!video || video.status !== 'ready' || !video.muxPlaybackId) {
    return (
      <View style={styles.messageWrap}>
        <ActivityIndicator size="large" color={colors.gold} style={styles.processingSpinner} />
        <Text style={styles.messageTitle}>Getting video ready&hellip;</Text>
        <Text style={styles.messageBody}>
          Your video is on its way &mdash; this usually takes under a minute.
        </Text>
        <CloseButton onPress={goBack} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {/*
       * key={messageId} forces a fresh AVPlayer native instance every time
       * this screen is opened. Without it, expo-av can reuse a stale player
       * from a previous mount and show a black screen on the second open.
       */}
      <Video
        key={messageId}
        style={styles.video}
        source={{ uri: muxHlsUrl(video.muxPlaybackId) }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        onPlaybackStatusUpdate={onStatusUpdate}
      />
      {isBuffering && (
        <View style={styles.bufferOverlay}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      )}
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
  // <Video> must NOT be sized via flex inside a centering container, or iOS
  // collapses the AVPlayerLayer to 0×0 (audio plays, picture is invisible).
  // Absolute-fill it so the native layer always has explicit screen-sized bounds.
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkest,
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
  processingSpinner: {
    marginBottom: spacing.lg,
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
