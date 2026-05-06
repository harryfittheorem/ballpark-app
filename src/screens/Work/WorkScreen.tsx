/**
 * WorkScreen — parent-side v0.6 Work tab.
 *
 * Sectioned list of every assignment for the family's (single) kid:
 *   To do      assignments where status='pending'
 *   Submitted  status='submitted', waiting on coach review
 *   Completed  status='reviewed', shows the coach rating
 *
 * Tap any row → AssignmentDetail. Empty / no-kid states mirror the
 * tone of EmptyHomeCard / SentVideosScreen so the surface feels native.
 */

import { useNavigation } from '@react-navigation/native';
import { Dumbbell } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AssignmentWithRefs } from '@/api/assignments';
import { useAssignments } from '@/hooks/useAssignments';
import { useFamily } from '@/hooks/useFamily';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

import AssignmentRow from './components/AssignmentRow';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

type Section = { title: string; data: AssignmentWithRefs[] };

export default function WorkScreen() {
  const navigation = useNavigation<Nav>();
  const { kids, loading: familyLoading } = useFamily();
  const kid = kids[0] ?? null;
  const { data, isPending, isError, error, refetch, isRefetching } = useAssignments(kid?.id);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const all = data ?? [];
    // "Due now" = pending and either no due_date set or due_date is today/past.
    // "Upcoming" = pending with a due_date strictly in the future.
    // Today comparison uses YYYY-MM-DD string compare so we don't have to
    // wrestle with timezones; due_date is a DATE column.
    const todayIso = new Date().toISOString().slice(0, 10);
    const dueNow = all.filter(
      (a) => a.status === 'pending' && (!a.due_date || a.due_date <= todayIso),
    );
    const upcoming = all.filter(
      (a) => a.status === 'pending' && !!a.due_date && a.due_date > todayIso,
    );
    const submitted = all.filter((a) => a.status === 'submitted');
    const done = all.filter((a) => a.status === 'reviewed');
    return [
      { title: 'Due now', data: dueNow },
      { title: 'Upcoming', data: upcoming },
      { title: 'Submitted', data: submitted },
      { title: 'Done', data: done },
    ].filter((s) => s.data.length > 0);
  }, [data]);

  const onRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  }, [refetch]);

  const refreshControl = (
    <RefreshControl
      refreshing={manualRefreshing || isRefetching}
      onRefresh={onRefresh}
      tintColor={colors.gold}
      colors={[colors.gold]}
    />
  );

  // No kid yet → friendly nudge to Home (where the AddKid flow lives).
  if (!kid && !familyLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <View style={styles.centered}>
          <View style={styles.emptyIconWrap}>
            <Dumbbell size={32} color={colors.gold} />
          </View>
          <Text style={styles.emptyTitle}>No drills yet</Text>
          <Text style={styles.emptyBody}>
            Add your kid on the Home tab to start receiving drill assignments
            from your coach.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (familyLoading || (kid && isPending)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load drills</Text>
          <Text style={styles.emptyBody}>{errorMessage(error)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header />
        <SectionList
          sections={[]}
          keyExtractor={() => 'noop'}
          renderItem={() => null}
          refreshControl={refreshControl}
          contentContainerStyle={styles.centered}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIconWrap}>
                <Dumbbell size={32} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>No drills yet</Text>
              <Text style={styles.emptyBody}>
                Your coach will send drill assignments here. Pull down to refresh.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <AssignmentRow
              assignment={item}
              onPress={() =>
                navigation.navigate('AssignmentDetail', { assignmentId: item.id })
              }
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Work</Text>
      <Text style={styles.subtitle}>Drills assigned by your coach</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
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
  listContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  sectionHeader: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginTop: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  rowWrap: { marginBottom: spacing.lg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
});
