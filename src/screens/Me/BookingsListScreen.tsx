/**
 * BookingsListScreen — sectioned list of all bookings for the family's kids,
 * split into Upcoming (scheduled_start >= now) and Past (scheduled_start <
 * now or terminal status). Pull-to-refresh re-runs the query. RLS scopes
 * everything to the caller's tenant + own family.
 */

import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FamilyBooking } from '@/api/bookings';
import { useFamilyBookings } from '@/hooks/useFamilyBookings';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import StatusBadge from './components/StatusBadge';

type Nav = MeStackScreenProps<'BookingsList'>['navigation'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const wk = WEEKDAYS[d.getDay()];
  const mo = MONTHS[d.getMonth()];
  const day = d.getDate();
  const h24 = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${wk}, ${mo} ${day} · ${h12}:${m} ${period}`;
}

type Section = { title: string; data: FamilyBooking[] };

function partitionBookings(bookings: FamilyBooking[]): Section[] {
  const now = Date.now();
  const upcoming: FamilyBooking[] = [];
  const past: FamilyBooking[] = [];
  for (const b of bookings) {
    const startMs = new Date(b.scheduled_start).getTime();
    const isTerminal =
      b.status === 'completed' || b.status === 'cancelled' || b.status === 'no_show';
    if (!isTerminal && startMs >= now) upcoming.push(b);
    else past.push(b);
  }
  upcoming.sort(
    (a, b) =>
      new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );
  past.sort(
    (a, b) =>
      new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime(),
  );
  const sections: Section[] = [];
  if (upcoming.length > 0) sections.push({ title: 'Upcoming', data: upcoming });
  if (past.length > 0) sections.push({ title: 'Past', data: past });
  return sections;
}

function BookingRow({
  booking,
  onPress,
}: {
  booking: FamilyBooking;
  onPress: () => void;
}) {
  const kidName = booking.kid
    ? `${booking.kid.first_name} ${booking.kid.last_name}`.trim()
    : 'Unknown kid';
  const coachName = booking.coach
    ? `Coach ${booking.coach.first_name} ${booking.coach.last_name}`.trim()
    : 'Coach TBD';
  const locationName = booking.location?.name ?? 'Location TBD';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.kidName}>{kidName}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.dateTime}>{formatDateTime(booking.scheduled_start)}</Text>
      <Text style={styles.meta}>
        {coachName} · {locationName}
      </Text>
    </TouchableOpacity>
  );
}

export default function BookingsListScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isPending, isError, error, refetch, isRefetching } = useFamilyBookings();
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => partitionBookings(data ?? []), [data]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing || isRefetching}
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
          <Text style={styles.errorTitle}>Couldn&apos;t load bookings</Text>
          <Text style={styles.errorMessage}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
          <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <SectionList
          sections={[]}
          keyExtractor={(item) => item.id}
          renderItem={() => null}
          refreshControl={refreshControl}
          contentContainerStyle={styles.emptyContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyMessage}>Book your first session!</Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookingRow
            booking={item}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        stickySectionHeadersEnabled={false}
        refreshControl={refreshControl}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  listContent: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  sectionHeader: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginTop: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  row: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  kidName: {
    flex: 1,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginRight: spacing.lg,
  },
  dateTime: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  meta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  emptyBox: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  emptyMessage: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  retryBtn: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['4xl'],
  },
  retryText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
