/**
 * Video Playback screen (v0.4 Step 4.13).
 *
 * Full-screen Mux HLS player for a single coach_message. Registered in
 * both HomeStackNavigator and WorkStackNavigator so the X button always
 * returns to whichever tab the user came from.
 *
 * Overlay logic (three-layer guard):
 *   1. `videoReady` — false until onReadyForDisplay fires (actual pixels on
 *      screen). Prevents the "black screen + timer running" bug where the
 *      AVPlayerLayer is playing audio but hasn't painted a frame yet.
 *   2. `isBuffering` — from onPlaybackStatusUpdate. Safety timeout re-arms
 *      on every buffering event so replay after finish never gets stuck.
 *   3. `BUFFERING_TIMEOUT_MS` safety — force-clears both guards if no event
 *      arrives within 8 s (slow HLS manifest / cold start / iOS quirks).
 *
 * key={messageId} on <Video> forces a fresh AVPlayer native instance each
 * time the screen is opened so a previously-stale layer can't cause a
 * black-screen repro on the second open.
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

type VideoPlaybackParams = { messageId: string };
type Route = RouteProp<{ VideoPlayback: VideoPlaybackParams }, 'VideoPlayback'>;

const BUFFERING_TIMEOUT_MS = 8000;

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { messageId } = route.params;

  const qc = useQueryClient();

  const { data: message, isPending, error } = useCoachMessage(messageId, {
    refetchInterval: (query) => {
      const d = query.state.data as { video?: { status?: string } | null } | null | undefined;
      if (d && d.video && d.video.status === 'processing') return 3000;
      return false;
    },
  });

  // videoReady: true once onReadyForDisplay fires (actual pixels painted).
  // Starts false — overlay stays on until AVPlayerLayer has real frames.
  const [videoReady, setVideoReady] = useState(false);
  // isBuffering: mirrors the native player's buffering state.
  // Starts false because the overlay is already covered by !videoReady.
  const [isBuffering, setIsBuffering] = useState(false);

  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markedRef = useRef(false);

  // Re-usable helper: arm (or re-arm) the safety timeout.
  // Called on initial video-ready and on every subsequent buffering event
  // so replay after finish never produces a permanently-stuck spinner.
  const armSafetyTimeout = useCallback(() => {
    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    bufferTimerRef.current = setTimeout(() => {
      setVideoReady(true);
      setIsBuffering(false);
    }, BUFFERING_TIMEOUT_MS);
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (bufferTimerRef.current) {
      clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
  }, []);

  // Arm the initial safety timeout as soon as the video row is ready.
  // Cleanup on unmount (or when message changes during processing-poll).
  useEffect(() => {
    const video = (message as { video?: { status?: string; muxPlaybackId?: string } | null } | null)?.video;
    if (!video || video.status !== 'ready' || !video.muxPlaybackId) return;
    armSafetyTimeout();
    return () => clearSafetyTimeout();
  }, [message, armSafetyTimeout, clearSafetyTimeout]);

  // Invalidate the Home card cache on unmount.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: ['coachMessages', 'latest'] });
    };
  }, [qc]);

  // onReadyForDisplay fires when AVPlayerLayer has painted the first frame.
  // This is the right signal to hide the "black screen" overlay — NOT the
  // first isBuffering=false event, which can arrive before pixels show.
  const onReadyForDisplay = useCallback(() => {
    setVideoReady(true);
    clearSafetyTimeout();
  }, [clearSafetyTimeout]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      if (status.didJustFinish) {
        // Video reached the end. Clear overlay so replay is clean.
        setIsBuffering(false);
        clearSafetyTimeout();
      } else if (status.isBuffering) {
        // Mid-playback buffer stall OR replay-seek buffer.
        // Re-arm the safety timeout so we never get permanently stuck.
        setIsBuffering(true);
        armSafetyTimeout();
      } else {
        setIsBuffering(false);
        clearSafetyTimeout();
      }

      // Mark-viewed guard (fires at most once per mount).
      if (markedRef.current) return;
      if (status.isPlaying || (status.positionMillis ?? 0) > 0) {
        markedRef.current = true;
        markViewed.mutate();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [armSafetyTimeout, clearSafetyTimeout],
  );

  const markViewed = useMutation({
    mutationFn: () => markCoachMessageViewed(messageId),
    onError: (err) => {
      console.warn('markCoachMessageViewed failed:', errorMessage(err));
    },
  });

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const topInset = insets.top;

  // Overlay is visible when AVPlayer hasn't painted frames yet OR is
  // mid-buffer stall. Both guards must be clear before we hide it.
  const showOverlay = !videoReady || isBuffering;

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

  if (!video || !video.muxPlaybackId) {
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
       * this screen is opened, preventing stale-layer black-screen repros.
       */}
      <Video
        key={messageId}
        style={styles.video}
        source={{ uri: muxHlsUrl(video.muxPlaybackId) }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        onReadyForDisplay={onReadyForDisplay}
        onPlaybackStatusUpdate={onStatusUpdate}
      />
      {showOverlay && (
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
