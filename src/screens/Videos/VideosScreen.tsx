/**
 * VideosScreen — task #119.
 *
 * Four sub-tabs: SWINGS (BY SESSION / ALL toggle), HOMEWORK (every drill
 * assignment with full submission metadata), MESSAGES (full coach-video
 * rail backed by the same `coach_messages` rows the Home card uses),
 * FAVORITES (the heart-toggled subset of swings).
 *
 * The Drills + Coach data is fetched here directly so the rail behaves
 * like the Home card (CoachVideoCard) — TanStack Query dedupes by key
 * with the Home queries.
 */

import { useNavigation } from '@react-navigation/native';
import { Heart, Mail, ZapOff } from 'lucide-react-native';
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

import type { Swing } from '@/api/swings';
import type { Session } from '@/api/sessions';
import type { AssignmentWithRefs } from '@/api/assignments';
import type { LatestCoachMessage } from '@/api/coachMessages';
import { useAssignments } from '@/hooks/useAssignments';
import { useCoachMessagesForKid } from '@/hooks/useCoachMessages';
import { useFamily } from '@/hooks/useFamily';
import {
  useFavoriteSwingIds,
  useSessionsForKid,
  useSwingsForKid,
} from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import AssignmentRow from '@/screens/Work/components/AssignmentRow';
import CoachVideoCard from '@/screens/Home/components/CoachVideoCard';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';
import { formatRelativeTime } from '@/utils/time';

import EmptyState from './components/EmptyState';
import SessionGroupCard from './components/SessionGroupCard';
import StatsBar from './components/StatsBar';
import SubTabBar, { type VideosSubTabKey } from './components/SubTabBar';
import SwingThumbnail from './components/SwingThumbnail';

type Nav = VideosStackScreenProps<'VideosHome'>['navigation'];

type SwingViewMode = 'session' | 'all';

const POSTER_WIDTH = 480;
function muxPosterUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

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
  const { data: coachMessages } = useCoachMessagesForKid(kid?.id);

  const swingsBySession = useMemo(() => {
    const map = new Map<string | null, Swing[]>();
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

  // Spec stats: TOTAL / PRs / SESSIONS.
  const totalSwings = swings?.length ?? 0;
  const prCount = (swings ?? []).filter((s) => s.is_personal_best).length;
  const sessionCount = sessions?.length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header />
      <View style={styles.statsWrap}>
        <StatsBar
          stats={[
            { label: 'Total', value: String(totalSwings) },
            { label: 'PRs', value: String(prCount) },
            { label: 'Sessions', value: String(sessionCount) },
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
          messages={coachMessages ?? []}
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
      <Text style={styles.subtitle}>Swings, homework, and messages</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Swings tab
// ---------------------------------------------------------------------------
type SwingsTabProps = {
  mode: SwingViewMode;
  onModeChange: (m: SwingViewMode) => void;
  isError: boolean;
  errorMsg: string | null;
  allSwings: Swing[];
  sessions: Session[];
  swingsBySession: Map<string | null, Swing[]>;
  favorites: Set<string>;
  onPressSwing: (swingId: string) => void;
  onPressSession: (sessionId: string) => void;
};

function SwingsTab({
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
}: SwingsTabProps) {
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
        ListHeaderComponent={<ModeToggle mode={mode} onChange={onModeChange} />}
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

  // BY SESSION view. We render one card per session; loose swings (those
  // whose `session_id` is null because the polling worker imported them
  // before the session row reconciled) are bucketed at the top so they're
  // never lost from the rail.
  const looseSwings = swingsBySession.get(null) ?? [];
  const looseRows: { kind: 'loose'; swings: Swing[] }[] =
    looseSwings.length > 0 ? [{ kind: 'loose', swings: looseSwings }] : [];
  const sessionRows = sessions.map((s) => ({ kind: 'session' as const, session: s }));
  type Row = (typeof looseRows)[number] | (typeof sessionRows)[number];
  const rows: Row[] = [...looseRows, ...sessionRows];

  return (
    <FlatList<Row>
      data={rows}
      keyExtractor={(r) => (r.kind === 'loose' ? 'loose' : r.session.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<ModeToggle mode={mode} onChange={onModeChange} />}
      renderItem={({ item }) => {
        if (item.kind === 'loose') {
          return (
            <View style={styles.looseCard}>
              <Text style={styles.looseTitle}>RECENT SWINGS · NEW SESSION SYNCING</Text>
              <View style={styles.previewRow}>
                {item.swings.slice(0, 3).map((s) => (
                  <View key={s.id} style={styles.previewCell}>
                    <SwingThumbnail
                      swing={s}
                      favorited={favorites.has(s.id)}
                      onPress={() => onPressSwing(s.id)}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        }
        const swings = swingsBySession.get(item.session.id) ?? [];
        return (
          <SessionGroupCard
            session={item.session}
            previewSwings={swings}
            favorites={favorites}
            onPressSession={() => onPressSession(item.session.id)}
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
// Homework tab — submission-centric. Reuses the Work tab's AssignmentRow
// so status badges + star ratings + due/feedback metadata stay consistent.
// ---------------------------------------------------------------------------
function HomeworkTab({
  assignments,
  onPress,
}: {
  assignments: AssignmentWithRefs[];
  onPress: (assignmentId: string) => void;
}) {
  if (assignments.length === 0) {
    return (
      <EmptyState
        icon={<ZapOff size={26} color={colors.gold} />}
        title="No drills yet"
        body="When your coach assigns a drill, it'll show up here with the video, your submission, and the feedback."
      />
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.listContent}>
      {assignments.map((a) => (
        <View key={a.id} style={styles.assignmentWrap}>
          <AssignmentRow assignment={a} onPress={() => onPress(a.id)} />
          {a.status === 'reviewed' && a.feedback ? (
            <View style={styles.feedbackQuote}>
              <Text style={styles.feedbackText} numberOfLines={2}>
                &ldquo;{a.feedback}&rdquo;
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Messages tab — coach-video rail. Reuses CoachVideoCard so it visually
// matches the Home card.
// ---------------------------------------------------------------------------
function MessagesTab({
  messages,
  onPress,
}: {
  messages: LatestCoachMessage[];
  onPress: (messageId: string) => void;
}) {
  if (messages.length === 0) {
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
      {messages.map((m) => {
        const v = m.video;
        const ready = v && v.status === 'ready' && v.muxPlaybackId;
        const coachName = m.coach
          ? `${m.coach.firstName} ${m.coach.lastName}`.trim()
          : 'Your coach';
        return (
          <View key={m.id} style={{ marginBottom: spacing['2xl'] }}>
            <CoachVideoCard
              variant={ready ? 'ready' : 'processing'}
              coachName={coachName}
              thumbnail={ready ? muxPosterUrl(v!.muxPlaybackId as string) : undefined}
              durationSeconds={v?.durationSeconds ?? undefined}
              subtitle={formatRelativeTime(m.createdAt)}
              unread={!m.viewedAt}
              onPress={ready ? () => onPress(m.id) : undefined}
            />
          </View>
        );
      })}
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
  swings: Swing[];
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
  looseCard: {
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  looseTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    marginBottom: spacing.lg,
  },
  previewRow: { flexDirection: 'row', gap: spacing.lg },
  previewCell: { flex: 1 },
  assignmentWrap: { marginBottom: spacing.lg },
  feedbackQuote: {
    marginTop: spacing.xs,
    marginLeft: spacing['3xl'],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
  },
  feedbackText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
  },
});
