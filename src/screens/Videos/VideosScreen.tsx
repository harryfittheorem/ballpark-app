/**
 * VideosScreen — task #119.
 *
 * Four sub-tabs: Swings (BY SESSION / ALL toggle), Drills (homework
 * playback queue), Coach (latest coach video messages), Favorites (the
 * heart-toggled subset of swings).
 *
 * The Drills + Coach tabs reuse data already fetched elsewhere in the
 * app (assignments, sentCoachMessages, latestCoachMessage) so we do NOT
 * duplicate fetch logic here — TanStack Query dedupes by key.
 */

import { useNavigation } from '@react-navigation/native';
import { Dumbbell, Heart, Mail, ZapOff } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAssignments } from '@/hooks/useAssignments';
import { useFamily } from '@/hooks/useFamily';
import { useLatestCoachMessage } from '@/hooks/useLatestCoachMessage';
import {
  useFavoriteSwingIds,
  useSessionsForKid,
  useSwingsForKid,
} from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

import EmptyState from './components/EmptyState';
import SessionGroupCard from './components/SessionGroupCard';
import StatsBar from './components/StatsBar';
import SubTabBar, { type VideosSubTabKey } from './components/SubTabBar';
import SwingThumbnail from './components/SwingThumbnail';

type Nav = VideosStackScreenProps<'VideosHome'>['navigation'];

type SwingViewMode = 'session' | 'all';

export default function VideosScreen() {
  const navigation = useNavigation<Nav>();
  const { kids, loading: familyLoading } = useFamily();
  const kid = kids[0] ?? null;
  const [tab, setTab] = useState<VideosSubTabKey>('swings');
  const [swingMode, setSwingMode] = useState<SwingViewMode>('session');

  const { data: swings, isPending: swingsPending, isError: swingsError, error: swingsErr } =
    useSwingsForKid(kid?.id);
  const { data: sessions, isPending: sessionsPending } = useSessionsForKid(kid?.id);
  const { data: favorites } = useFavoriteSwingIds();
  const { data: assignments } = useAssignments(kid?.id);
  const { data: latestMessage } = useLatestCoachMessage(kid?.id);

  // Group swings by session_id for the BY SESSION view. Swings whose
  // `session_id` is null (rare — happens when the polling worker imported
  // a swing before the session row was reconciled) are bucketed into a
  // synthetic "Loose swings" group at the top so they're never lost.
  const swingsBySession = useMemo(() => {
    type SwingRow = NonNullable<typeof swings>[number];
    const map = new Map<string | null, SwingRow[]>();
    (swings ?? []).forEach((s) => {
      const k = s.session_id;
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    });
    return map;
  }, [swings]);

  const favSet = favorites ?? new Set<string>();
  const favoriteSwings = useMemo(
    () => (swings ?? []).filter((s) => favSet.has(s.id)),
    [swings, favSet],
  );

  if (familyLoading || (kid && (swingsPending || sessionsPending))) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!kid) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <EmptyState
          icon={<ZapOff size={26} color={colors.gold} />}
          title="No kid yet"
          body="Add your kid on Home to start collecting swings, drills, and coach videos."
        />
      </SafeAreaView>
    );
  }

  const totalSwings = swings?.length ?? 0;
  const prCount = (swings ?? []).filter((s) => s.is_personal_best).length;
  const topVelo = (swings ?? []).reduce<number | null>((acc, s) => {
    const v = s.exit_velocity_mph ?? null;
    if (v == null) return acc;
    if (acc == null || v > acc) return v;
    return acc;
  }, null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header />
      <View style={styles.statsWrap}>
        <StatsBar
          stats={[
            { label: 'Swings', value: String(totalSwings) },
            { label: 'PRs', value: String(prCount) },
            { label: 'Top mph', value: topVelo == null ? '—' : topVelo.toFixed(1) },
          ]}
        />
      </View>
      <SubTabBar value={tab} onChange={setTab} />

      {tab === 'swings' ? (
        <SwingsTab
          mode={swingMode}
          onModeChange={setSwingMode}
          isError={swingsError}
          errorMsg={swingsError ? errorMessage(swingsErr) : null}
          allSwings={swings ?? []}
          sessions={sessions ?? []}
          swingsBySession={swingsBySession}
          favorites={favSet}
          onPressSwing={(id) => navigation.navigate('SwingDetail', { swingId: id })}
          onPressSession={(id) => navigation.navigate('SessionDetail', { sessionId: id })}
        />
      ) : null}

      {tab === 'homework' ? (
        <HomeworkTab
          assignments={assignments ?? []}
          onPress={(assignmentId) =>
            navigation.navigate('Work', { screen: 'AssignmentDetail', params: { assignmentId } })
          }
        />
      ) : null}

      {tab === 'messages' ? (
        <MessagesTab
          latestId={latestMessage?.id ?? null}
          coachName={
            latestMessage?.coach
              ? `${latestMessage.coach.firstName} ${latestMessage.coach.lastName}`.trim()
              : null
          }
          createdAt={latestMessage?.createdAt ?? null}
          onPress={(messageId) =>
            navigation.navigate('Home', { screen: 'VideoPlayback', params: { messageId } })
          }
        />
      ) : null}

      {tab === 'favorites' ? (
        <FavoritesTab
          swings={favoriteSwings}
          favorites={favSet}
          onPressSwing={(id) => navigation.navigate('SwingDetail', { swingId: id })}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Videos</Text>
      <Text style={styles.subtitle}>Swings, drills, and coach messages</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Swings tab
// ---------------------------------------------------------------------------
function SwingsTab(props: {
  mode: SwingViewMode;
  onModeChange: (m: SwingViewMode) => void;
  isError: boolean;
  errorMsg: string | null;
  allSwings: ReturnType<typeof useSwingsForKid>['data'] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  sessions: ReturnType<typeof useSessionsForKid>['data'] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  swingsBySession: Map<string | null, typeof props.allSwings>;
  favorites: Set<string>;
  onPressSwing: (swingId: string) => void;
  onPressSession: (sessionId: string) => void;
}) {
  const {
    mode,
    onModeChange,
    isError,
    errorMsg,
    allSwings,
    sessions,
    swingsBySession,
    favorites,
    onPressSwing,
    onPressSession,
  } = props;

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMsg ?? 'Could not load swings'}</Text>
      </View>
    );
  }

  if (allSwings.length === 0) {
    return (
      <EmptyState
        icon={<ZapOff size={26} color={colors.gold} />}
        title="No swings yet"
        body="Connect HitTrax from Me → HitTrax. Your cage swings will land here automatically."
      />
    );
  }

  if (mode === 'all') {
    return (
      <FlatList
        data={allSwings}
        keyExtractor={(s) => s.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={
          <ModeToggle mode={mode} onChange={onModeChange} />
        }
        renderItem={({ item }) => (
          <View style={styles.gridCell}>
            <SwingThumbnail
              swing={item}
              favorited={favorites.has(item.id)}
              onPress={() => onPressSwing(item.id)}
            />
          </View>
        )}
      />
    );
  }

  // BY SESSION view. Map known session rows to their swings; if a session
  // has no swings (rare race) we still render its header so the count
  // matches the session list cardinality.
  return (
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<ModeToggle mode={mode} onChange={onModeChange} />}
      renderItem={({ item }) => {
        const swings = swingsBySession.get(item.id) ?? [];
        return (
          <SessionGroupCard
            session={item}
            previewSwings={swings}
            favorites={favorites}
            onPressSession={() => onPressSession(item.id)}
            onPressSwing={onPressSwing}
          />
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon={<ZapOff size={26} color={colors.gold} />}
          title="No sessions yet"
          body="Sessions land here once HitTrax syncs your first cage time."
        />
      }
    />
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: SwingViewMode;
  onChange: (m: SwingViewMode) => void;
}) {
  const opts: { key: SwingViewMode; label: string }[] = [
    { key: 'session', label: 'By session' },
    { key: 'all', label: 'All swings' },
  ];
  return (
    <View style={styles.toggleRow}>
      {opts.map((o) => {
        const active = o.key === mode;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.togglePill, active && styles.togglePillActive]}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
              {o.label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Homework / Drills tab
// ---------------------------------------------------------------------------
function HomeworkTab({
  assignments,
  onPress,
}: {
  assignments: { id: string; title: string; status: string; drill_video: { mux_playback_id: string | null } | null }[];
  onPress: (assignmentId: string) => void;
}) {
  // Surface drills that have a Mux drill video — the Videos tab is a
  // playback surface, so drills with no video belong on Work, not here.
  const withVideo = assignments.filter((a) => a.drill_video?.mux_playback_id);
  if (withVideo.length === 0) {
    return (
      <EmptyState
        icon={<Dumbbell size={26} color={colors.gold} />}
        title="No drill videos yet"
        body="Drills your coach assigns with a video will appear here for replay."
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      {withVideo.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => onPress(a.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Dumbbell size={18} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
            <Text style={styles.rowSubtitle}>{a.status.toUpperCase()}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Messages tab
// ---------------------------------------------------------------------------
function MessagesTab({
  latestId,
  coachName,
  createdAt,
  onPress,
}: {
  latestId: string | null;
  coachName: string | null;
  createdAt: string | null;
  onPress: (messageId: string) => void;
}) {
  if (!latestId) {
    return (
      <EmptyState
        icon={<Mail size={26} color={colors.gold} />}
        title="No coach messages yet"
        body="When a coach sends a video, it lands here and on Home."
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      <Pressable
        onPress={() => onPress(latestId)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <Mail size={18} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {coachName ?? 'Your coach'}
          </Text>
          <Text style={styles.rowSubtitle}>
            {createdAt ? new Date(createdAt).toLocaleDateString() : ''}
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Favorites tab
// ---------------------------------------------------------------------------
function FavoritesTab({
  swings,
  favorites,
  onPressSwing,
}: {
  swings: ReturnType<typeof useSwingsForKid>['data'] extends infer T
    ? T extends Array<infer U>
      ? U[]
      : never
    : never;
  favorites: Set<string>;
  onPressSwing: (swingId: string) => void;
}) {
  if (swings.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={26} color={colors.gold} />}
        title="No favorites yet"
        body="Tap the heart on a swing to save it here."
      />
    );
  }
  return (
    <FlatList
      data={swings}
      keyExtractor={(s) => s.id}
      numColumns={3}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.gridContent}
      renderItem={({ item }) => (
        <View style={styles.gridCell}>
          <SwingThumbnail
            swing={item}
            favorited={favorites.has(item.id)}
            onPress={() => onPressSwing(item.id)}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
  statsWrap: {
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing['3xl'],
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  gridContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  gridRow: { gap: spacing.lg, marginBottom: spacing.lg },
  gridCell: { flex: 1 },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginBottom: spacing['2xl'],
  },
  togglePill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  togglePillActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  toggleText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  toggleTextActive: { color: colors.dark },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  rowTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
  },
  rowSubtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
    marginTop: spacing.xxs,
  },
});
