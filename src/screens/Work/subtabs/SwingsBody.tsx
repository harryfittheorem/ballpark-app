import { useNavigation } from '@react-navigation/native';
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

import type { Swing } from '@/api/swings';
import { useFamily } from '@/hooks/useFamily';
import {
  useFavoriteSwingIds,
  useSessionsForKid,
  useSwingsForKid,
} from '@/hooks/useSwings';
import type { WorkStackScreenProps } from '@/navigation/types';
import EmptyState from '@/screens/Videos/components/EmptyState';
import SessionGroupCard from '@/screens/Videos/components/SessionGroupCard';
import SwingThumbnail from '@/screens/Videos/components/SwingThumbnail';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];
type Mode = 'session' | 'all';

export default function SwingsBody() {
  const navigation = useNavigation<Nav>();
  const { kids, loading: familyLoading } = useFamily();
  const kid = kids[0] ?? null;
  const [mode, setMode] = useState<Mode>('session');

  const { data: swings, isPending: swingsPending, isError, error } = useSwingsForKid(kid?.id);
  const { data: sessions, isPending: sessionsPending } = useSessionsForKid(kid?.id);
  const { data: favorites } = useFavoriteSwingIds();

  const swingsBySession = useMemo(() => {
    const map = new Map<string | null, Swing[]>();
    (swings ?? []).forEach((s) => {
      const arr = map.get(s.session_id) ?? [];
      arr.push(s);
      map.set(s.session_id, arr);
    });
    return map;
  }, [swings]);

  const favSet = favorites ?? new Set<string>();

  if (familyLoading || (kid && (swingsPending || sessionsPending))) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (!kid) {
    return (
      <EmptyState
        icon={<ZapOff size={26} color={colors.gold} />}
        title="No kid yet"
        body="Add your kid on Home to start collecting swings."
      />
    );
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage(error)}</Text>
      </View>
    );
  }
  if ((swings ?? []).length === 0) {
    return (
      <EmptyState
        icon={<ZapOff size={26} color={colors.gold} />}
        title="No swings yet"
        body="Connect HitTrax from Me → HitTrax. Cage swings will land here automatically."
      />
    );
  }

  if (mode === 'all') {
    return (
      <FlatList
        data={swings ?? []}
        keyExtractor={(s) => s.id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={<ModeToggle mode={mode} onChange={setMode} />}
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
    );
  }

  const looseSwings = swingsBySession.get(null) ?? [];
  const looseRows: { kind: 'loose'; swings: Swing[] }[] =
    looseSwings.length > 0 ? [{ kind: 'loose', swings: looseSwings }] : [];
  const sessionRows = (sessions ?? []).map((s) => ({ kind: 'session' as const, session: s }));
  type Row = (typeof looseRows)[number] | (typeof sessionRows)[number];
  const rows: Row[] = [...looseRows, ...sessionRows];

  return (
    <FlatList<Row>
      data={rows}
      keyExtractor={(r) => (r.kind === 'loose' ? 'loose' : r.session.id)}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<ModeToggle mode={mode} onChange={setMode} />}
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
                      favorited={favSet.has(s.id)}
                      onPress={() => navigation.navigate('SwingDetail', { swingId: s.id })}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        }
        const sessionSwings = swingsBySession.get(item.session.id) ?? [];
        return (
          <SessionGroupCard
            session={item.session}
            previewSwings={sessionSwings}
            favorites={favSet}
            onPressSession={() =>
              navigation.navigate('SessionDetail', { sessionId: item.session.id })
            }
            onPressSwing={(id) => navigation.navigate('SwingDetail', { swingId: id })}
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

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opts: { key: Mode; label: string }[] = [
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  listContent: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['6xl'] },
  gridContent: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['6xl'] },
  gridRow: { gap: spacing.lg, marginBottom: spacing.lg },
  gridCell: { flex: 1 },
  toggleRow: { flexDirection: 'row', gap: spacing.base, marginBottom: spacing['2xl'] },
  togglePill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  togglePillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
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
});
