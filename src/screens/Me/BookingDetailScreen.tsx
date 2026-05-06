/**
 * BookingDetailScreen — full info for a single booking + soft-cancel action.
 *
 * Loads via `useBooking(bookingId)` so the screen is robust to direct
 * deep-links and refresh (it doesn't depend on the BookingsList cache being
 * warm). The Cancel button only renders when the booking is in a
 * cancellable state: status === 'confirmed' | 'pending' AND
 * scheduled_start is in the future. Two-step UX: confirm Alert → optional
 * `Alert.prompt` reason on iOS (Android falls back to a no-reason cancel
 * since `Alert.prompt` is iOS-only).
 */

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FamilyBooking } from '@/api/bookings';
import { useBooking } from '@/hooks/useBooking';
import { useCancelBooking } from '@/hooks/useCancelBooking';
import type { MeStackParamList, MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

import StatusBadge from './components/StatusBadge';

type Nav = MeStackScreenProps<'BookingDetail'>['navigation'];

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

function isCancellable(b: FamilyBooking): boolean {
  if (b.status !== 'confirmed' && b.status !== 'pending') return false;
  return new Date(b.scheduled_start).getTime() > Date.now();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MeStackParamList, 'BookingDetail'>>();
  const { bookingId } = route.params;

  const { data: booking, isPending, isError, error, refetch } = useBooking(bookingId);
  const cancelMut = useCancelBooking();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const cancellable = useMemo(() => (booking ? isCancellable(booking) : false), [booking]);

  const performCancel = (reason?: string) => {
    setSubmitError(null);
    cancelMut.mutate(
      { bookingId, reason },
      {
        onSuccess: () => navigation.goBack(),
        onError: (err) => setSubmitError(errorMessage(err)),
      },
    );
  };

  const handleCancelPress = () => {
    Alert.alert(
      'Cancel this booking?',
      'You can re-book the slot afterwards if it is still available.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () => {
            // Alert.prompt is iOS-only. On Android we proceed without a
            // typed reason; v0.5+ can replace this with a custom modal.
            if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
              Alert.prompt(
                'Reason (optional)',
                'Let your coach know why if you want.',
                [
                  { text: 'Skip', style: 'cancel', onPress: () => performCancel() },
                  {
                    text: 'Send',
                    onPress: (text?: string) => performCancel(text),
                  },
                ],
                'plain-text',
              );
            } else {
              performCancel();
            }
          },
        },
      ],
    );
  };

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !booking) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load booking</Text>
          <Text style={styles.errorMessage}>
            {isError ? errorMessage(error) : 'This booking is no longer available.'}
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const kidName = booking.kid
    ? `${booking.kid.first_name} ${booking.kid.last_name}`.trim()
    : 'Unknown kid';
  const coachName = booking.coach
    ? `Coach ${booking.coach.first_name} ${booking.coach.last_name}`.trim()
    : 'Coach TBD';
  const locationName = booking.location?.name ?? 'Location TBD';
  const sessionLabel = booking.session_type
    ? `${booking.session_type.name} · ${booking.session_type.duration_minutes} min`
    : 'Session';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{sessionLabel}</Text>
          <StatusBadge status={booking.status} />
        </View>

        <Text style={styles.dateLine}>{formatLongDate(booking.scheduled_start)}</Text>
        <Text style={styles.timeLine}>
          {formatTimeRange(booking.scheduled_start, booking.scheduled_end)}
        </Text>

        <View style={styles.card}>
          <Field label="Athlete" value={kidName} />
          <Field label="Coach" value={coachName} />
          <Field label="Location" value={locationName} />
          {booking.cage_number != null ? (
            <Field label="Cage" value={`#${booking.cage_number}`} />
          ) : null}
          {booking.session_type?.type_category ? (
            <Field
              label="Type"
              value={
                booking.session_type.type_category.charAt(0).toUpperCase() +
                booking.session_type.type_category.slice(1)
              }
            />
          ) : null}
          {booking.notes ? <Field label="Notes" value={booking.notes} /> : null}
        </View>

        {booking.status === 'cancelled' ? (
          <View style={styles.card}>
            <Field
              label="Cancelled"
              value={booking.cancelled_at ? formatLongDate(booking.cancelled_at) : '—'}
            />
            {booking.cancellation_reason ? (
              <Field label="Reason" value={booking.cancellation_reason} />
            ) : null}
          </View>
        ) : null}

        {cancellable ? (
          <>
            <TouchableOpacity
              onPress={handleCancelPress}
              style={[styles.cancelBtn, cancelMut.isPending && styles.cancelBtnDisabled]}
              disabled={cancelMut.isPending}
            >
              {cancelMut.isPending ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.cancelText}>Cancel booking</Text>
              )}
            </TouchableOpacity>
            {submitError ? (
              <Text style={styles.inlineError}>{submitError}</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  content: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginRight: spacing.lg,
  },
  dateLine: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
  timeLine: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginBottom: spacing['3xl'],
  },
  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
  },
  cancelBtn: {
    marginTop: spacing.lg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelText: {
    color: colors.danger,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  inlineError: {
    color: colors.danger,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.lg,
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
