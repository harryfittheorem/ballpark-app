/**
 * SessionDetailScreen — task #119.
 *
 * Header = StatsBar (Swings / Avg / Best / PRs). Filter pills below it
 * (All / PRs / Best / Contact) narrow the 4-column swing grid. Tapping a
 * swing tile pushes Swing Detail.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ZapOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Swing } from '@/api/swings';
import {
  useFavoriteSwingIds,
  useSession,
  useSwingsForSession,
} from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

import EmptyState from './components/EmptyState';
import StatsBar from './components/StatsBar';
import SwingThumbnail from './components/SwingThumbnail';

type Route = VideosStackScreenProps<'SessionDetail'>['route'];
type Nav = VideosStackScreenProps<'SessionDetail'>['navigation'];

type FilterKey = 'all' | 'pr' | 'best' | 'contact';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pr', label: 'PRs' },
  { key: 'best', label: 'Best' },
  { key: 'contact', label: 'Contact' },
];

// "Best" = the top quartile by exit velocity. We compute a threshold over
// the session set and pass swings whose exit velo lies above it. "Contact"
// = swings whose `result` indicates clean contact (HitTrax stores values
// like 'line_drive', 'fly_ball', 'ground_ball', 'hit', 'hr', 'foul', 'miss').
// We treat anything that ISN'T a 'miss' / 'foul' / 'whiff' as contact.
function pctile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

const NON_CONTACT = new Set(['miss', 'foul', 'whiff', 'swing_and_miss']);

export default function SessionDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { sessionId } = route.params;

  const { data: session, isPending: sessionPending, isError, error } = useSession(sessionId);
  const { data: swings, isPending: swingsPending } = useSwingsForSession(sessionId);
  const { data: favorites } = useFavoriteSwingIds();
  const [filter, setFilter] = useState<FilterKey>('all');

  const allSwings = swings ?? [];
  const bestThreshold = useMemo(
    () =>
      pctile(
        allSwings.map((s) => s.exit_velocity_mph).filter((v): v is number => v != null),
        0.75,
      ),
    [allSwings],
  );

  const filtered: Swing[] = useMemo(() => {
    switch (filter) {
      case 'pr':
        return allSwings.filter((s) => s.is_personal_best);
      case 'best':
        if (bestThreshold == null) return [];
        return allSwings.filter(
          (s) => s.exit_velocity_mph != null && s.exit_velocity_mph >= bestThreshold,
        );
      case 'contact':
        return allSwings.filter(
          (s) => s.result != null && !NON_CONTACT.has(s.result.toLowerCase()),
        );
      case 'all':
      default:
        return allSwings;
    }
  }, [allSwings, filter, bestThreshold]);

  if (sessionPending || swingsPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{isError ? errorMessage(error) : 'Session not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const date = new Date(session.started_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const favSet = favorites ?? new Set<string>();
  const prCount = allSwings.filter((s) => s.is_personal_best).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>{dateLabel.toUpperCase()}</Text>
      </View>
      <View style={styles.statsWrap}>
        <StatsBar
          stats={[
            { label: 'Swings', value: String(session.swing_count ?? allSwings.length) },
            {
              label: 'Avg mph',
              value:
                session.avg_exit_velocity_mph != null
                  ? Number(session.avg_exit_velocity_mph).toFixed(1)
                  : '—',
            },
            {
              label: 'Best mph',
              value:
                session.best_exit_velocity_mph != null
                  ? Number(session.best_exit_velocity_mph).toFixed(1)
                  : '—',
            },
            { label: 'PRs', value: String(prCount) },
          ]}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ZapOff size={26} color={colors.gold} />}
          title={
            filter === 'all'
              ? 'No swings in this session'
              : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} swings`
          }
          body={
            filter === 'all'
              ? 'HitTrax may still be syncing — pull to refresh in a moment.'
              : 'Try a different filter.'
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <SwingThumbnail
                swing={item}
                favorited={favSet.has(item.id)}
                onPress={() => navigation.navigate('SwingDetail', { swingId: item.id })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  headerWrap: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
  },
  statsWrap: { paddingHorizontal: spacing['3xl'], marginBottom: spacing['2xl'] },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.base,
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  filterPill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  filterPillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  filterText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  filterTextActive: { color: colors.dark },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing['3xl'],
    textAlign: 'center',
  },
  gridContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  gridRow: { gap: spacing.base, marginBottom: spacing.base },
  gridCell: { flex: 1 },
});
