import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AGE_GROUPS, type AgeGroup } from '@/constants/kid';
import { useFamily } from '@/hooks/useFamily';
import {
  useHitTraxLeaderboard,
  useLessonCountLeaderboard,
  usePointsLeaderboard,
} from '@/hooks/useLeaderboard';
import type { HitTraxMetric, LeaderboardScope, AgeGroupFilter } from '@/api/leaderboard';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BoardView = 'points' | 'performance' | 'lessons';

// 'all' = no filter (all kids), 'unranked' = kids with no age_group set.
type AgeGroupChip = AgeGroup | 'all' | 'unranked';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.gold} />
    </View>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function EmptyState({ label }: { label: string }) {
  return <Text style={styles.empty}>{label}</Text>;
}

function RankPill({ rank }: { rank: number }) {
  return (
    <View style={[styles.rankPill, rank <= 3 && styles.rankPillTop]}>
      <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>#{rank}</Text>
    </View>
  );
}

// Small segmented-toggle button used inside sub-views.
function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.toggleBar}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Points sub-view (existing)
// ---------------------------------------------------------------------------

function PointsView({ ownKidIds }: { ownKidIds: string[] }) {
  const { data, isPending, isError, error } = usePointsLeaderboard();
  const ownSet = new Set(ownKidIds);

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error)?.message ?? 'Could not load ranks'} />;

  const rows = data ?? [];

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.kidId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.boardTitle}>Points Board</Text>
          <Text style={styles.boardSubtitle}>Top 50 athletes by total points</Text>
        </View>
      }
      ListEmptyComponent={<EmptyState label="No athletes ranked yet." />}
      renderItem={({ item }) => {
        const mine = ownSet.has(item.kidId);
        return (
          <View style={[styles.row, mine && styles.rowMine]}>
            <RankPill rank={item.rank} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>
                {item.firstName} {item.lastName}
                {mine ? ' · YOU' : ''}
              </Text>
            </View>
            <Text style={styles.statValue}>{(item.pointsBalance ?? 0).toLocaleString()}</Text>
          </View>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Performance (HitTrax) sub-view
// ---------------------------------------------------------------------------

const METRIC_OPTIONS: { key: HitTraxMetric; label: string; unit: string }[] = [
  { key: 'exit_velocity_mph', label: 'Exit Velocity', unit: 'mph' },
  { key: 'distance_ft',       label: 'Distance',      unit: 'ft'  },
];

const SCOPE_OPTIONS: { key: LeaderboardScope; label: string }[] = [
  { key: 'national',  label: 'National'  },
  { key: 'clubhouse', label: 'Clubhouse' },
];

const AGE_GROUP_FILTER_OPTIONS: { key: AgeGroupChip; label: string }[] = [
  { key: 'all',      label: 'All'      },
  ...AGE_GROUPS.map((g) => ({ key: g as AgeGroupChip, label: g })),
  { key: 'unranked', label: 'Unranked' },
];

function PerformanceView({
  ownKidIds,
  locationId,
}: {
  ownKidIds: string[];
  locationId: string | null;
}) {
  const [metric, setMetric]    = useState<HitTraxMetric>('exit_velocity_mph');
  const [scope, setScope]      = useState<LeaderboardScope>('national');
  const [ageGroup, setAgeGroup] = useState<AgeGroupChip>('all');

  const ownSet = new Set(ownKidIds);
  // 'all' → null (no filter), 'unranked' → 'unranked' sentinel, otherwise exact match.
  const ageGroupFilter: AgeGroupFilter = ageGroup === 'all' ? null : ageGroup;
  const effectiveLocationId = scope === 'clubhouse' ? locationId : null;

  const { data, isPending, isError, error } = useHitTraxLeaderboard({
    metric,
    scope,
    locationId: effectiveLocationId,
    ageGroup:   ageGroupFilter,
  });

  const currentMetaUnit = METRIC_OPTIONS.find((m) => m.key === metric)?.unit ?? '';
  const rows = data ?? [];
  // Check whether any own kid appears in the returned top-50 list.
  const ownInList = rows.some((r) => ownSet.has(r.kidId));
  const hasOwnKids = ownKidIds.length > 0;

  return (
    <View style={styles.subViewRoot}>
      {/* Metric toggle */}
      <Toggle<HitTraxMetric>
        options={METRIC_OPTIONS.map((m) => ({ key: m.key, label: m.label }))}
        value={metric}
        onChange={setMetric}
      />

      {/* Scope toggle */}
      <Toggle<LeaderboardScope>
        options={SCOPE_OPTIONS}
        value={scope}
        onChange={setScope}
      />

      {/* Age group chips — includes 'Unranked' bucket for kids with no age group set */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {AGE_GROUP_FILTER_OPTIONS.map((opt) => {
          const active = opt.key === ageGroup;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setAgeGroup(opt.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {isPending ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? 'Could not load performance board'} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.kidId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.boardTitle}>
                {METRIC_OPTIONS.find((m) => m.key === metric)?.label ?? 'Performance'} Records
              </Text>
              <Text style={styles.boardSubtitle}>
                {scope === 'clubhouse'
                  ? 'Top 10 at your location · all-time personal bests'
                  : 'Top 40 nationally · all-time personal bests'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              label={
                scope === 'clubhouse' && !locationId
                  ? 'Set a home location to see the clubhouse board.'
                  : 'No HitTrax records found. Hit some swings!'
              }
            />
          }
          ListFooterComponent={
            hasOwnKids && !ownInList && rows.length > 0 ? (
              <View style={styles.outsideTopRow}>
                <Text style={styles.outsideTopText}>
                  You're outside the top {scope === 'clubhouse' ? 10 : 40} — keep swinging!
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const mine = ownSet.has(item.kidId);
            return (
              <View style={[styles.row, mine && styles.rowMine]}>
                <RankPill rank={item.rank} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>
                    {item.firstName} {item.lastName}
                    {mine ? ' · YOU' : ''}
                  </Text>
                  {item.ageGroup ? (
                    <Text style={styles.ageGroupBadge}>{item.ageGroup}</Text>
                  ) : (
                    <Text style={[styles.ageGroupBadge, styles.ageGroupUnranked]}>Unranked</Text>
                  )}
                </View>
                <Text style={styles.statValue}>
                  {typeof item.value === 'number'
                    ? `${item.value % 1 === 0 ? item.value : item.value.toFixed(1)} ${currentMetaUnit}`
                    : '—'}
                </Text>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Lessons sub-view
// ---------------------------------------------------------------------------

function LessonsView({
  ownKidIds,
  locationId,
}: {
  ownKidIds: string[];
  locationId: string | null;
}) {
  const ownSet = new Set(ownKidIds);

  const { data, isPending, isError, error } = useLessonCountLeaderboard({ locationId });

  if (isPending) return <LoadingState />;
  if (isError) return <ErrorState message={(error as Error)?.message ?? 'Could not load lesson board'} />;

  const rows = data ?? [];
  const ownInList = rows.some((r) => ownSet.has(r.kidId));
  const hasOwnKids = ownKidIds.length > 0;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.kidId}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={styles.boardTitle}>Lesson Leaders</Text>
          <Text style={styles.boardSubtitle}>
            {locationId
              ? 'Top 10 at your location · completed lessons'
              : 'Top 40 nationally · completed lessons'}
          </Text>
        </View>
      }
      ListEmptyComponent={
        <EmptyState label="No completed lessons yet — book your first session!" />
      }
      ListFooterComponent={
        hasOwnKids && !ownInList && rows.length > 0 ? (
          <View style={styles.outsideTopRow}>
            <Text style={styles.outsideTopText}>
              You're outside the top {locationId ? 10 : 40} — keep booking lessons!
            </Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => {
        const mine = ownSet.has(item.kidId);
        return (
          <View style={[styles.row, mine && styles.rowMine]}>
            <RankPill rank={item.rank} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>
                {item.firstName} {item.lastName}
                {mine ? ' · YOU' : ''}
              </Text>
            </View>
            <View style={styles.lessonCountWrap}>
              <Text style={styles.statValue}>{item.lessonCount}</Text>
              <Text style={styles.lessonUnit}>lessons</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

const VIEW_OPTIONS: { key: BoardView; label: string }[] = [
  { key: 'points',      label: 'Points'      },
  { key: 'performance', label: 'Performance' },
  { key: 'lessons',     label: 'Lessons'     },
];

export default function RanksTab({ ownKidIds }: { ownKidIds: string[] }) {
  const [view, setView] = useState<BoardView>('points');
  const { family } = useFamily();

  // Use the family's primary location for clubhouse scope.
  const locationId = family?.primary_location_id ?? null;

  const handleViewChange = useCallback((v: BoardView) => setView(v), []);

  return (
    <View style={styles.root}>
      {/* Top-level segmented control */}
      <View style={styles.segmentedBar}>
        {VIEW_OPTIONS.map((opt) => {
          const active = opt.key === view;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handleViewChange(opt.key)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Body */}
      <View style={styles.body}>
        {view === 'points' && <PointsView ownKidIds={ownKidIds} />}
        {view === 'performance' && (
          <PerformanceView ownKidIds={ownKidIds} locationId={locationId} />
        )}
        {view === 'lessons' && (
          <LessonsView ownKidIds={ownKidIds} locationId={locationId} />
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Top segmented control (Points / Performance / Lessons)
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius.full,
    padding: spacing.xs,
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentBtnActive: { backgroundColor: colors.gold },
  segmentLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  segmentLabelActive: { color: colors.dark },

  // Sub-view root
  subViewRoot: { flex: 1 },

  // Metric / scope toggles
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius.full,
    padding: spacing.xs,
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  toggleBtnActive: { backgroundColor: colors.dark },
  toggleLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  toggleLabelActive: { color: colors.gold },

  // Age-group chips
  chipRow: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  chipLabelActive: { color: colors.dark },

  // Shared list styles
  body: { flex: 1 },
  list: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  listHeader: {
    paddingVertical: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  boardTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  boardSubtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  rowMine: { borderColor: colors.gold },
  rowBody: { flex: 1 },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  ageGroupBadge: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  ageGroupUnranked: {
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Out-of-top-50 footer row
  outsideTopRow: {
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  outsideTopText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Rank pill
  rankPill: {
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankPillTop: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  rankText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
    letterSpacing: tracking.wide,
  },
  rankTextTop: { color: colors.dark },

  // Stat value
  statValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },

  // Lesson count
  lessonCountWrap: { alignItems: 'flex-end' },
  lessonUnit: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Misc
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
    minHeight: 200,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing['5xl'],
  },
});
