/**
 * Training video player (v0.7 task #121).
 *
 * Hero 16:9 Mux player + breadcrumb + metadata strip. Mirrors the
 * pattern in `VideoPlaybackScreen` (expo-av, useNativeControls, no
 * audio mode override). Adds:
 *   - Resume from AsyncStorage `training_progress` map (if a non-zero
 *     last position exists for this kid + video).
 *   - Throttled write of last position back to AsyncStorage every
 *     ~3 seconds during playback.
 *   - One-shot `record_training_view` RPC fire on first real
 *     playback start, gated by a useRef so a burst of expo-av status
 *     ticks only fires it once per mount.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TRAINING_CATEGORIES } from '@/api/trainingVideos';
import { useFamily } from '@/hooks/useFamily';
import { useRecordTrainingView, useTrainingVideo } from '@/hooks/useTrainingVideos';
import type { TrainStackScreenProps } from '@/navigation/types';
import { readProgress, writeProgress } from '@/store/trainingProgress';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = TrainStackScreenProps<'TrainingVideoPlayer'>['navigation'];
type Route = TrainStackScreenProps<'TrainingVideoPlayer'>['route'];

function muxHlsUrl(id: string): string {
  return `https://stream.mux.com/${id}.m3u8`;
}

function categoryLabel(cat: string): string {
  return TRAINING_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrainingVideoPlayerScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { videoId } = route.params;
  const { kids } = useFamily();
  const kid = kids[0] ?? null;

  const { data: video, isPending, error } = useTrainingVideo(videoId);
  const recordView = useRecordTrainingView();

  const videoRef = useRef<Video | null>(null);
  const viewMarkedRef = useRef(false);
  const lastWriteRef = useRef<number>(0);
  const lastPosRef = useRef<number>(0);
  const lastDurRef = useRef<number | null>(null);
  const seekedRef = useRef(false);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);

  // Read the last saved position once when the screen mounts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!kid) return;
      const map = await readProgress(kid.id);
      const cur = map[videoId];
      if (!cancelled && cur && cur.positionSec > 5) setResumeFrom(cur.positionSec);
    })();
    return () => {
      cancelled = true;
    };
  }, [kid, videoId]);

  // Save the last position when the screen unmounts so we always
  // capture where the kid actually left off (the throttle in
  // onStatusUpdate may have skipped the very last tick).
  useEffect(() => {
    return () => {
      if (kid && lastPosRef.current > 0) {
        void writeProgress(
          kid.id,
          videoId,
          lastPosRef.current,
          lastDurRef.current,
        );
      }
    };
  }, [kid, videoId]);

  const onStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;

      // First successful position read: seek to resume point if set.
      if (!seekedRef.current && resumeFrom != null) {
        seekedRef.current = true;
        // expo-av seek is in millis.
        videoRef.current
          ?.setPositionAsync(resumeFrom * 1000, {
            toleranceMillisBefore: 0,
            toleranceMillisAfter: 0,
          })
          .catch(() => undefined);
      }

      const posSec = (status.positionMillis ?? 0) / 1000;
      const durSec =
        status.durationMillis != null ? status.durationMillis / 1000 : null;
      lastPosRef.current = posSec;
      lastDurRef.current = durSec;

      // Fire the view RPC on the first real playback tick.
      if (!viewMarkedRef.current && kid) {
        if (status.isPlaying || posSec > 0) {
          viewMarkedRef.current = true;
          recordView.mutate(
            { videoId, kidId: kid.id },
            {
              onError: (err) => {
                // eslint-disable-next-line no-console
                console.warn('record_training_view failed:', errorMessage(err));
              },
            },
          );
        }
      }

      // Throttle position writes to ~once every 3 seconds.
      const now = Date.now();
      if (kid && status.isPlaying && now - lastWriteRef.current > 3000) {
        lastWriteRef.current = now;
        void writeProgress(kid.id, videoId, posSec, durSec);
      }
    },
    [kid, recordView, resumeFrom, videoId],
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Back to Train"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>Train</Text>
        <View style={{ width: 36 }} />
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : error || !video ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&rsquo;t load video</Text>
          <Text style={styles.errorBody}>
            {error ? errorMessage(error) : 'This video may have been removed.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.heroBox}>
            <Video
              ref={(r) => {
                videoRef.current = r;
              }}
              style={StyleSheet.absoluteFill}
              source={{ uri: muxHlsUrl(video.muxPlaybackId) }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
              onPlaybackStatusUpdate={onStatusUpdate}
            />
          </View>

          <Text style={styles.crumb}>
            {categoryLabel(video.category).toUpperCase()} · {video.level.toUpperCase()}
          </Text>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.meta}>
            {fmtDuration(video.durationSec)}
            {video.coachName ? `  ·  ${video.coachName}` : ''}
            {`  ·  ${video.viewCount.toLocaleString()} views`}
          </Text>
          {video.description ? (
            <Text style={styles.body}>{video.description}</Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
  },
  scroll: { paddingBottom: spacing['7xl'] },
  heroBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.darkest,
  },
  crumb: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    paddingHorizontal: spacing['3xl'],
    marginTop: spacing.base,
  },
  meta: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    paddingHorizontal: spacing['3xl'],
    marginTop: spacing.base,
    letterSpacing: tracking.wide,
  },
  body: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    paddingHorizontal: spacing['3xl'],
    marginTop: spacing['2xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing['4xl'],
  },
  errorTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
  },
  errorBody: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
});
