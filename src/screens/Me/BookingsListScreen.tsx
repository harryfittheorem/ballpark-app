/**
 * BookingsListScreen — sectioned list of all bookings for the family's kids,
 * split into Upcoming (scheduled_start >= now) and Past (scheduled_start <
 * now or terminal status). Also shows active waitlist entries with a
 * "Waitlisted — #N in queue" badge. Pull-to-refresh re-runs all queries.
 * RLS scopes everything to the caller's tenant + own family.
 */

import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useWaitlistEntries, useLeaveWaitlist } from '@/hooks/useWaitlistEntries';
import type { WaitlistEntryRich } from '@/api/waitlist';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

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

type Section =
  | { title: string; kind: 'bookings'; data: FamilyBooking[] }
  | { title: string; kind: 'waitlist'; data: WaitlistEntryRich[] };

function partitionBookings(bookings: FamilyBooking[]): {
  upcoming: FamilyBooking[];
  past: FamilyBooking[];
} {
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
  return { upcoming, past };
}

function WaitlistRow({
  entry,
  onLeave,
  onClaim,
}: {
  entry: WaitlistEntryRich;
  onLeave: () => void;
  onClaim: () => void;
}) {
  const kidName = entry.kid
    ? `${entry.kid.first_name} ${entry.kid.last_name}`.trim()
    : 'Unknown kid';
  const coachName = entry.coach
    ? `Coach ${entry.coach.first_name} ${entry.coach.last_name}`.trim()
    : 'Coach TBD';
  const locationName = entry.location?.name ?? 'Location TBD';
  const sessionName = entry.session_type?.name ?? 'Session';
  const isNotified = entry.status === 'notified';

  return (
    <View style={styles.waitlistRow}>
      <View style={styles.rowHeader}>
        <Text style={styles.kidName}>{kidName}</Text>
        <View style={[styles.waitlistBadge, isNotified && styles.waitlistBadgeNotified]}>
          <Text style={[styles.waitlistBadgeText, isNotified && styles.waitlistBadgeTextNotified]}>
            {isNotified ? '🎉 SPOT AVAILABLE' : `WAITLISTED — #${entry.position} IN QUEUE`}
          </Text>
        </View>
      </View>
      <Text style={styles.dateTime}>{formatDateTime(entry.scheduled_start)}</Text>
      <Text style={styles.meta}>
        {sessionName} · {coachName} · {locationName}
      </Text>

      {isNotified && entry.claim_deadline ? (
        <Text style={styles.claimDeadlineText}>
          Claim within 2 hours · Offer expires soon
        </Text>
      ) : null}

      <View style={styles.waitlistActions}>
        {isNotified ? (
          <TouchableOpacity
            onPress={onClaim}
            activeOpacity={0.7}
            style={styles.claimBtn}
          >
            <Text style={styles.claimBtnText}>Claim This Spot</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={onLeave}
          activeOpacity={0.7}
          style={styles.leaveBtn}
        >
          <Text style={styles.leaveBtnText}>Leave Waitlist</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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
  const bookingsQuery = useFamilyBookings();
  const waitlistQuery = useWaitlistEntries();
  const leaveWaitlist = useLeaveWaitlist();
  const [refreshing, setRefreshing] = useState(false);

  const { upcoming, past } = useMemo(
    () => partitionBookings(bookingsQuery.data ?? []),
    [bookingsQuery.data],
  );

  const sections = useMemo<Section[]>(() => {
    const waitlistEntries = waitlistQuery.data ?? [];
    const out: Section[] = [];
    if (waitlistEntries.length > 0) {
      out.push({ title: 'On Waitlist', kind: 'waitlist', data: waitlistEntries });
    }
    if (upcoming.length > 0) out.push({ title: 'Upcoming', kind: 'bookings', data: upcoming });
    if (past.length > 0) out.push({ title: 'Past', kind: 'bookings', data: past });
    return out;
  }, [waitlistQuery.data, upcoming, past]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([bookingsQuery.refetch(), waitlistQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLeaveWaitlist = (entry: WaitlistEntryRich) => {
    Alert.alert(
      'Leave Waitlist',
      'Remove yourself from the waitlist for this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leaveWaitlist.mutate(entry.id, {
              onError: (err) => {
                Alert.alert('Error', errorMessage(err));
              },
            });
          },
        },
      ],
    );
  };

  const handleClaimSpot = (entry: WaitlistEntryRich) => {
    navigation.navigate('WaitlistClaim', { waitlistId: entry.id });
  };

  const isPending = bookingsQuery.isPending && waitlistQuery.isPending;
  const isError = bookingsQuery.isError;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing || bookingsQuery.isRefetching || waitlistQuery.isRefetching}
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
            {bookingsQuery.error instanceof Error ? bookingsQuery.error.message : 'Unknown error'}
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
          keyExtractor={(item) => (item as FamilyBooking).id}
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
      <SectionList<FamilyBooking | WaitlistEntryRich, Section>
        sections={sections}
        keyExtractor={(item) => (item as FamilyBooking | WaitlistEntryRich).id}
        renderItem={({ item, section }) => {
          if (section.kind === 'waitlist') {
            const entry = item as unknown as WaitlistEntryRich;
            return (
              <WaitlistRow
                entry={entry}
                onLeave={() => handleLeaveWaitlist(entry)}
                onClaim={() => handleClaimSpot(entry)}
              />
            );
          }
          const booking = item as FamilyBooking;
          return (
            <BookingRow
              booking={booking}
              onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
            />
          );
        }}
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
  waitlistRow: {
    backgroundColor: colors.dark,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.base,
  },
  kidName: {
    flex: 1,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginRight: spacing.lg,
  },
  waitlistBadge: {
    backgroundColor: 'rgba(155,149,144,0.15)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.base,
    paddingVertical: 2,
    flexShrink: 0,
  },
  waitlistBadgeNotified: {
    backgroundColor: 'rgba(168,198,127,0.15)',
    borderColor: colors.success,
  },
  waitlistBadgeText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    letterSpacing: tracking.wide,
  },
  waitlistBadgeTextNotified: {
    color: colors.success,
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
  claimDeadlineText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.warning,
  },
  waitlistActions: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.base,
  },
  claimBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  claimBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    color: colors.dark,
    letterSpacing: tracking.wide,
  },
  leaveBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
  },
  leaveBtnText: {
    fontFamily: fontFamilies.interMedium,
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
