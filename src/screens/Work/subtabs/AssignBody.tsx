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

import type { AssignmentWithRefs } from '@/api/assignments';
import { useAssignments } from '@/hooks/useAssignments';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import type { WorkStackScreenProps } from '@/navigation/types';
import AssignmentRow from '@/screens/Work/components/AssignmentRow';
import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';
import { todayLocalIso } from '@/utils/date';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];
type Section = { title: string; data: AssignmentWithRefs[] };

export default function AssignBody() {
  const navigation = useNavigation<Nav>();
  const { kid, loading: familyLoading } = useSelectedKid();
  const { data, isPending, isError, error, refetch, isRefetching } = useAssignments(kid?.id);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const all = data ?? [];
    const todayIso = todayLocalIso();
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
      refreshing={manualRefreshing}
      onRefresh={onRefresh}
      tintColor={colors.gold}
      colors={[colors.gold]}
    />
  );

  if (!kid && !familyLoading) {
    return (
      <Empty
        title="No drills yet"
        body="Add your kid on the Home tab to start receiving drill assignments."
      />
    );
  }
  if (familyLoading || (kid && isPending)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Couldn&apos;t load drills</Text>
        <Text style={styles.emptyBody}>{errorMessage(error)}</Text>
      </View>
    );
  }
  if (sections.length === 0) {
    return (
      <SectionList
        sections={[]}
        keyExtractor={() => 'noop'}
        renderItem={() => null}
        refreshControl={refreshControl}
        contentContainerStyle={styles.centered}
        ListEmptyComponent={
          <Empty
            title="No drills yet"
            body="Your coach will send drill assignments here. Pull down to refresh."
          />
        }
      />
    );
  }

  return (
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
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIconWrap}>
        <Dumbbell size={32} color={colors.gold} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['6xl'] },
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
