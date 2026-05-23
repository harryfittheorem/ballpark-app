import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Play } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  TRAINING_CATEGORIES,
  type TrainingVideo,
  type TrainingVideoCategory,
} from '@/api/trainingVideos';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useTrainingProgress, useTrainingVideos } from '@/hooks/useTrainingVideos';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Filter = 'all' | TrainingVideoCategory;
type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...TRAINING_CATEGORIES.map((c) => ({ value: c.value as Filter, label: c.label })),
];

function muxThumb(playbackId: string, w = 480): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${w}&fit_mode=smartcrop`;
}

function categoryLabel(cat: TrainingVideoCategory): string {
  return TRAINING_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DrillsBody() {
  const navigation = useNavigation<Nav>();
  const { kid } = useSelectedKid();

  const [filter, setFilter] = useState<Filter>('all');
  const { data: videos, isPending, refetch, isRefetching } = useTrainingVideos(filter);
  const { map: progress, refresh: refreshProgress } = useTrainingProgress(kid?.id);

  useFocusEffect(
    useCallback(() => {
      void refreshProgress();
    }, [refreshProgress]),
  );

  const featured = useMemo<TrainingVideo | null>(() => {
    if (!videos || videos.length === 0) return null;
    return videos.find((v) => v.featured) ?? videos[0];
  }, [videos]);

  const continueWatching = useMemo<TrainingVideo[]>(() => {
    if (!videos) return [];
    return videos
      .filter((v) => {
        const p = progress[v.id];
        if (!p) return false;
        if (p.durationSec && p.positionSec / p.durationSec > 0.95) return false;
        return p.positionSec > 5;
      })
      .sort((a, b) => (progress[b.id]?.updatedAt ?? 0) - (progress[a.id]?.updatedAt ?? 0))
      .slice(0, 8);
  }, [videos, progress]);

  const grid = videos ?? [];

  const onPlay = useCallback(
    (v: TrainingVideo) => {
      navigation.navigate('TrainingVideoPlayer', { videoId: v.id });
    },
    [navigation],
  );

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          tintColor={colors.gold}
          refreshing={isRefetching}
          onRefresh={() => {
            void refetch();
            void refreshProgress();
          }}
        />
      }
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Pressable
              key={f.value}
              onPress={() => setFilter(f.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isPending ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}

      {featured ? (
        <View style={{ marginTop: spacing['3xl'] }}>
          <Text style={styles.sectionLabel}>NEW THIS WEEK</Text>
          <Pressable
            onPress={() => onPlay(featured)}
            style={({ pressed }) => [styles.hero, pressed && { opacity: 0.92 }]}
            accessibilityRole="button"
            accessibilityLabel={`Play ${featured.title}`}
          >
            <Image
              source={{ uri: muxThumb(featured.muxPlaybackId, 720) }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.heroOverlay}>
              <View style={styles.playBadge}>
                <Play size={28} color={colors.dark} fill={colors.dark} />
              </View>
            </View>
            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {featured.title}
              </Text>
              <Text style={styles.heroSub}>
                {fmtDuration(featured.durationSec)} · {categoryLabel(featured.category)} ·{' '}
                {featured.level}
              </Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      {continueWatching.length > 0 ? (
        <View style={{ marginTop: spacing['4xl'] }}>
          <Text style={styles.sectionLabel}>CONTINUE WATCHING</Text>
          <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            {continueWatching.map((v) => {
              const p = progress[v.id];
              const pct =
                p?.durationSec && p.positionSec
                  ? Math.min(1, p.positionSec / p.durationSec)
                  : 0;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => onPlay(v)}
                  style={({ pressed }) => [styles.cwRow, pressed && { opacity: 0.9 }]}
                >
                  <Image
                    source={{ uri: muxThumb(v.muxPlaybackId, 200) }}
                    style={styles.cwThumb}
                    resizeMode="cover"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cwTitle} numberOfLines={1}>
                      {v.title}
                    </Text>
                    <Text style={styles.cwMeta}>
                      {fmtDuration(v.durationSec)} · {categoryLabel(v.category)} · {v.level}
                    </Text>
                    <View style={styles.cwBarTrack}>
                      <View
                        style={[styles.cwBarFill, { width: `${Math.round(pct * 100)}%` }]}
                      />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {grid.length > 0 ? (
        <View style={{ marginTop: spacing['4xl'] }}>
          <Text style={styles.sectionLabel}>
            {filter === 'all'
              ? 'ALL TRAINING'
              : `ALL IN ${categoryLabel(filter as TrainingVideoCategory).toUpperCase()}`}
          </Text>
          <FlatList
            data={grid}
            keyExtractor={(v) => v.id}
            numColumns={2}
            columnWrapperStyle={{ gap: spacing.lg }}
            contentContainerStyle={{ gap: spacing.lg, marginTop: spacing.lg }}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPlay(item)}
                style={({ pressed }) => [styles.gridCard, pressed && { opacity: 0.9 }]}
              >
                <Image
                  source={{ uri: muxThumb(item.muxPlaybackId, 360) }}
                  style={styles.gridThumb}
                  resizeMode="cover"
                />
                <Text style={styles.gridTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.gridMeta} numberOfLines={1}>
                  {fmtDuration(item.durationSec)} · {categoryLabel(item.category)}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : !isPending ? (
        <View style={[styles.loadingBox, { marginTop: spacing['4xl'] }]}>
          <Text style={styles.empty}>No videos here yet.</Text>
          <Text style={styles.emptySub}>
            Your facility hasn&rsquo;t published any training videos in this category yet.
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['7xl'] },
  chipRow: { gap: spacing.base, paddingVertical: spacing.base, paddingRight: spacing['3xl'] },
  chip: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textOnDark,
    letterSpacing: tracking.wide,
  },
  chipLabelActive: { color: colors.dark },
  sectionLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wider,
  },
  hero: {
    marginTop: spacing.lg,
    borderRadius: radius['3xl'],
    overflow: 'hidden',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImage: { width: '100%', aspectRatio: 16 / 10 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 60,
  },
  playBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: { padding: spacing['2xl'], gap: spacing.xs },
  heroTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
  },
  heroSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  loadingBox: { paddingVertical: spacing['5xl'], alignItems: 'center', gap: spacing.base },
  empty: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
  },
  emptySub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  cwRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cwThumb: { width: 80, height: 60, borderRadius: radius.lg, backgroundColor: colors.dark },
  cwTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
  },
  cwMeta: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  cwBarTrack: {
    marginTop: spacing.base,
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  cwBarFill: { height: '100%', backgroundColor: colors.gold },
  gridCard: {
    flex: 1,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  gridThumb: { width: '100%', aspectRatio: 16 / 10, backgroundColor: colors.dark },
  gridTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  gridMeta: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: 2,
  },
});
