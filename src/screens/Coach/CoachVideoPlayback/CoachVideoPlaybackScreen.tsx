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
import { ResizeMode, Video } from 'expo-av';
import { X } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, spacing } from '@/theme';

type Route = CoachInboxStackScreenProps<'CoachVideoPlayback'>['route'];
type Nav = CoachInboxStackScreenProps<'CoachVideoPlayback'>['navigation'];

function muxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

export default function CoachVideoPlaybackScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { playbackId } = route.params;

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.fill}>
      <Video
        style={styles.fill}
        source={{ uri: muxHlsUrl(playbackId) }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        useNativeControls
      />
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
});
