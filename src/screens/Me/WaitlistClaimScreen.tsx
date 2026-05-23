/**
 * WaitlistClaimScreen — deep-link destination when a waitlist push arrives.
 *
 * Shows session details and a "Claim This Spot" CTA. On success navigates to
 * the booking detail for the newly-created booking. Returns CLAIM_EXPIRED
 * gracefully if the 2-hour window has passed.
 */

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWaitlistEntries, useClaimWaitlistSpot } from '@/hooks/useWaitlistEntries';
import type { MeStackParamList, MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = MeStackScreenProps<'WaitlistClaim'>['navigation'];
type Route = RouteProp<MeStackParamList, 'WaitlistClaim'>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h24 = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m} ${period}`;
}

function formatTimeRange(startISO: string, endISO: string): string {
  return `${formatTime(startISO)} – ${formatTime(endISO)}`;
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  const diffHrs = Math.floor(diffMins / 60);
  return `${diffHrs} hour${diffHrs !== 1 ? 's' : ''}`;
}

export default function WaitlistClaimScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { waitlistId } = route.params;

  const { data: entries, isPending, isError } = useWaitlistEntries();
  const claimMutation = useClaimWaitlistSpot();

  const entry = entries?.find((e) => e.id === waitlistId) ?? null;

  const handleClaim = () => {
    claimMutation.mutate(waitlistId, {
      onSuccess: (result) => {
        if (result.code === 'OK') {
          navigation.replace('BookingDetail', { bookingId: result.booking_id });
        } else if (result.code === 'CLAIM_EXPIRED') {
          Alert.alert(
            'Spot Claimed',
            'The claim window has passed and this spot was offered to the next family on the waitlist.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
        } else {
          Alert.alert('Not Available', 'This spot is no longer available.');
          navigation.goBack();
        }
      },
      onError: (err) => {
        Alert.alert('Error', errorMessage(err));
      },
    });
  };

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !entry) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Spot No Longer Available</Text>
          <Text style={styles.errorMsg}>
            This waitlist spot has already been claimed or expired.
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isExpired =
    entry.status !== 'notified' ||
    (entry.claim_deadline != null && new Date(entry.claim_deadline).getTime() < Date.now());

  const timeLeft = entry.claim_deadline ? formatDeadline(entry.claim_deadline) : null;
  const kidName = entry.kid
    ? `${entry.kid.first_name} ${entry.kid.last_name}`.trim()
    : 'Athlete';
  const coachName = entry.coach
    ? `Coach ${entry.coach.first_name} ${entry.coach.last_name}`.trim()
    : null;
  const locationName = entry.location?.name ?? null;
  const sessionName = entry.session_type?.name ?? 'Session';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>🎉 SPOT AVAILABLE</Text>
        </View>
        <Text style={styles.title}>Claim Your Spot</Text>
        <Text style={styles.subtitle}>
          A spot opened up — tap below to confirm and lock it in for {kidName}.
        </Text>

        {/* Deadline banner */}
        {!isExpired && timeLeft ? (
          <View style={styles.deadlineBanner}>
            <Text style={styles.deadlineText}>
              ⏱ {timeLeft} remaining to claim
            </Text>
          </View>
        ) : null}

        {/* Session details card */}
        <View style={styles.detailCard}>
          <DetailRow label="Session" value={sessionName} />
          <DetailRow label="Athlete" value={kidName} />
          <DetailRow label="Date" value={formatLongDate(entry.scheduled_start)} />
          <DetailRow label="Time" value={formatTimeRange(entry.scheduled_start, entry.scheduled_end)} />
          {coachName ? <DetailRow label="Coach" value={coachName} /> : null}
          {locationName ? <DetailRow label="Location" value={locationName} /> : null}
          <DetailRow label="Queue Position" value={`#${entry.position}`} />
        </View>

        {/* CTA */}
        {isExpired ? (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredTitle}>Claim Window Expired</Text>
            <Text style={styles.expiredMsg}>
              This spot was passed to the next family in the queue.
            </Text>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.claimBtn, claimMutation.isPending && styles.claimBtnDisabled]}
            onPress={handleClaim}
            disabled={claimMutation.isPending}
            accessibilityRole="button"
          >
            {claimMutation.isPending ? (
              <ActivityIndicator color={colors.dark} size="small" />
            ) : (
              <Text style={styles.claimBtnText}>Claim This Spot</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.noChargeNote}>
          No charge — booking is confirmed immediately upon claiming.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  content: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
    alignItems: 'stretch',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(241,229,173,0.15)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    borderRadius: radius.full,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
    marginBottom: spacing['2xl'],
  },
  headerBadgeText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.textOnDark,
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: spacing['2xl'],
  },
  deadlineBanner: {
    backgroundColor: 'rgba(232,167,71,0.15)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
    alignItems: 'center',
  },
  deadlineText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.warning,
  },
  detailCard: {
    backgroundColor: colors.dark,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing['2xl'],
  },
  detailLabel: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  claimBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  claimBtnDisabled: {
    opacity: 0.6,
  },
  claimBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.dark,
    letterSpacing: tracking.wide,
  },
  noChargeNote: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  expiredBox: {
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  expiredTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
  },
  expiredMsg: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  errorMsg: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  backBtn: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['4xl'],
  },
  backBtnText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
