/**
 * ReviewQueueScreen — coach-side list of drills awaiting review.
 *
 * Pulls every assignment in the coach's tenant with status='submitted'.
 * Tap a row → ReviewAssignment.
 */

import { useNavigation } from '@react-navigation/native';
import { ClipboardCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCoachAssignments } from '@/hooks/useCoachAssignments';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = CoachInboxStackScreenProps<'ReviewQueue'>['navigation'];

function relative(ts: string | null): string {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReviewQueueScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isPending, isError, error, refetch, isRefetching } =
    useCoachAssignments('submitted');
  const [manualRefreshing, setManualRefreshing] = useState(false);

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

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load reviews</Text>
          <Text style={styles.muted}>{errorMessage(error)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <FlatList
          data={[]}
          keyExtractor={() => 'noop'}
          renderItem={() => null}
          refreshControl={refreshControl}
          contentContainerStyle={styles.centered}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIconWrap}>
                <ClipboardCheck size={32} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>All caught up</Text>
              <Text style={styles.muted}>No drills are waiting on your review.</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={refreshControl}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              navigation.navigate('ReviewAssignment', { assignmentId: item.id })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.kid ? `${item.kid.first_name} ${item.kid.last_name}` : 'Kid'} ·
                {' '}submitted {relative(item.submitted_at)}
              </Text>
            </View>
            <Text style={styles.rowAction}>Review</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  list: { padding: spacing['3xl'], gap: spacing.lg },
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
  muted: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  rowTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  rowMeta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  rowAction: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
});
