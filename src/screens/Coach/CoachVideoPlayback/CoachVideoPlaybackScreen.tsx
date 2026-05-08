/**
 * Coach-side video playback screen.
 *
 * Full-screen Mux HLS player used when the coach taps a row in
 * `SentVideosScreen`. Mirrors the parent VideoPlaybackScreen visually
 * but deliberately omits the `markCoachMessageViewed` mutation — only
 * the *parent* viewing the video should flip `viewed_at`. We also take
 * the playbackId directly via route params instead of refetching the
 * coach_message, since the row already has it in hand.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

type Route = CoachInboxStackScreenProps<'CoachVideoPlayback'>['route'];
type Nav = CoachInboxStackScreenProps<'CoachVideoPlayback'>['navigation'];

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export default function CoachVideoPlaybackScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { playbackId } = route.params;

  // Three reasons the screen can look "black" without this state:
  //  1. expo-av takes a beat to fetch the HLS manifest — show a poster
  //     + spinner so the coach has something to look at.
  //  2. The native controls only appear after the player tells us it's
  //     loaded; until then there's no visible chrome AT ALL except our
  //     overlay close button.
  //  3. If Mux returns an error (asset deleted, signing required, etc.)
  //     expo-av silently keeps a black surface — surface it as text.
  const [loaded, setLoaded] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setLoaded(true);
      setErrMsg(null);
    } else if (status.error) {
      setErrMsg(status.error);
    }
  }, []);

  return (
    <View style={styles.fill}>
      <Video
        style={styles.video}
        source={{ uri: muxHlsUrl(playbackId) }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
        onPlaybackStatusUpdate={onStatusUpdate}
        onError={(e: string) => setErrMsg(e)}
      />
      {!loaded && !errMsg ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      ) : null}
      {errMsg ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Couldn&rsquo;t play this video</Text>
          <Text style={styles.errorBody}>{errMsg}</Text>
        </View>
      ) : null}
      <SafeAreaView
        pointerEvents="box-none"
        style={styles.closeOverlay}
        edges={['top', 'left']}
      >
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Close video"
          hitSlop={12}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
        >
          <X size={22} color={colors.gold} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.darkest,
  },
  // The Video element MUST NOT live inside a flex container that
  // centers / collapses its children — on iOS the AVPlayerLayer renders
  // an invisible (audio-only) frame when its host view is sized to 0.
  // Absolute-fill it instead so the native layer always has explicit
  // bounds matching the screen.
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 14, 14, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.md,
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    textAlign: 'center',
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
});
