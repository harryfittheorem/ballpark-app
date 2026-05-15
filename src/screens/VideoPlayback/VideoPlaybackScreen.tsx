/**
 * Video Playback screen (v0.4 Step 4.13).
 *
 * Full-screen Mux HLS player for a single coach_message. Registered in
 * both HomeStackNavigator and WorkStackNavigator so the X button always
 * returns to whichever tab the user came from (goBack within the current
 * stack, not a cross-tab navigate).
 *
 * Fixes (Task #200 / #202):
 *   - `key={messageId}` forces a fresh AVPlayer native instance each open.
 *   - `isBuffering` overlay clears via `onPlaybackStatusUpdate`; a safety
 *     timeout (BUFFERING_TIMEOUT_MS) forces it off if the event is delayed.
 *     `didJustFinish` explicitly sets isBuffering=false so the overlay
 *     doesn't re-appear when the user replays a finished video.
 *   - Close button uses `useSafeAreaInsets` directly so it never collapses
 *     to the wrong position regardless of device or presentation context.
 *   - When video is still processing, polls every 3 s and auto-transitions
 *     to the player once status becomes 'ready'.
 */

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markCoachMessageViewed } from '@/api/coachMessages';
import { useCoachMessage } from '@/hooks/useCoachMessage';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

// Generic param type — works whether this screen is mounted in HomeStack
// or WorkStack (both define VideoPlayback: { messageId: string }).
type VideoPlaybackParams = { messageId: string };
type Route = RouteProp<{ VideoPlayback: VideoPlaybackParams }, 'VideoPlayback'>;

// How long to wait for the first AVPlaybackStatus event before forcibly
// clearing the buffering overlay. Avoids an infinite spinner when the HLS
// manifest loads slowly or the event is briefly delayed on cold start.
const BUFFERING_TIMEOUT_MS = 8000;

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

// Close button positioned using explicit safe-area insets so it never
// collapses to the wrong corner regardless of device or modal context.
function CloseButton({ onPress, topInset }: { onPress: () => void; topInset: number }) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.closeOverlay, { top: topInset }]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Close video"
        hitSlop={16}
        style={({ pressed }) => [
          styles.closeButton,
          pressed && styles.closePressed,
        ]}
      >
        <X size={22} color={colors.gold} />
      </Pressable>
    </View>
  );
}

export default function VideoPlaybackScreen() {
  const route = useRoute<Route>();
  // useNavigation without a generic — we only need goBack() / canGoBack(),
  // which exist on every navigation object regardless of stack.
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { messageId } = route.params;

  const qc = useQueryClient();

  // Poll every 3 s while the video is still processing so the screen
  // auto-advances to the player without the user having to navigate away.
  const { data: message, isPending, error } = useCoachMessage(messageId, {
    refetchInterval: (query) => {
      const d = query.state.data as { video?: { status?: string } | null } | null | undefined;
      if (d && d.video && d.video.status === 'processing') return 3000;
      return false;
    },
  });

  // Track native player buffering state to show/hide the spinner overlay.
  // Starts true; cleared by onPlaybackStatusUpdate or the safety timeout.
  const [isBuffering, setIsBuffering] = useState(true);
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Guard so the mark-viewed mutation only fires once per mount.
  const markedRef = useRef(false);

  const markViewed = useMutation({
    mutationFn: () => markCoachMessageViewed(messageId),
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.warn('markCoachMessageViewed failed:', errorMessage(err));
    },
  });

  // Start the safety timeout once we know the video is ready. Cleared if
  // onPlaybackStatusUpdate fires first (normal path).
  useEffect(() => {
    const video = (message as { video?: { status?: string; muxPlaybackId?: string } | null } | null)?.video;
    if (!video || video.status !== 'ready' || !video.muxPlaybackId) return;

    bufferTimerRef.current = setTimeout(() => {
      setIsBuffering(false);
    }, BUFFERING_TIMEOUT_MS);

    return () => {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, [message]);

  // Invalidate the Home "latest coach message" cache on unmount.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: ['coachMessages', 'latest'] });
    };
  }, [qc]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (status.isLoaded) {
        // didJustFinish: video is at end, not buffering — make sure overlay
        // stays hidden so a subsequent replay doesn't show a stuck spinner.
        if (status.didJustFinish) {
          setIsBuffering(false);
        } else {
          setIsBuffering(status.isBuffering);
        }

        // Cancel the safety timeout once we receive a real status update.
        if (!status.isBuffering && bufferTimerRef.current) {
          clearTimeout(bufferTimerRef.current);
          bufferTimerRef.current = null;
        }
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

  // Inset used for all CloseButton instances in this render.
  const topInset = insets.top;

  if (isPending) {
    return (
      <View style={styles.fill}>
        <ActivityIndicator color={colors.gold} />
        <CloseButton onPress={goBack} topInset={topInset} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>Couldn't load video</Text>
        <Text style={styles.messageBody}>{errorMessage(error)}</Text>
        <CloseButton onPress={goBack} topInset={topInset} />
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
        <CloseButton onPress={goBack} topInset={topInset} />
      </View>
    );
  }

  const video = message.video;

  // Video errored — permanent dead end.
  if (video?.status === 'errored') {
    return (
      <View style={styles.messageWrap}>
        <Text style={styles.messageTitle}>This video couldn't be processed</Text>
        <Text style={styles.messageBody}>
          Your coach will need to re-record and send this one again.
        </Text>
        <CloseButton onPress={goBack} topInset={topInset} />
      </View>
    );
  }

  // Video is still processing — show a spinner and let refetchInterval
  // poll until status flips to 'ready', then re-render into the player.
  if (!video || video.status !== 'ready' || !video.muxPlaybackId) {
    return (
      <View style={styles.messageWrap}>
        <ActivityIndicator size="large" color={colors.gold} style={styles.processingSpinner} />
        <Text style={styles.messageTitle}>Getting video ready…</Text>
        <Text style={styles.messageBody}>
          Your video is on its way — this usually takes under a minute.
        </Text>
        <CloseButton onPress={goBack} topInset={topInset} />
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
      <CloseButton onPress={goBack} topInset={topInset} />
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
  // <Video> must be absolute-fill so the native AVPlayerLayer always has
  // explicit bounds. Sizing via flex inside a centering container collapses
  // the layer to 0×0 on iOS (audio plays but picture is invisible).
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darkest,
  },
  // Positioned absolutely at top:0 + topInset (injected as inline style).
  // Using a plain View instead of SafeAreaView avoids the collapse bug where
  // SafeAreaView computes zero height in some fullScreenModal presentations.
  closeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  closeButton: {
    margin: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 14, 14, 0.72)',
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
