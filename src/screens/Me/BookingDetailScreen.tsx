/**
 * BookingDetailScreen — full info for a single booking + policy-aware cancel.
 *
 * Cancellation flow:
 *  1. User taps "Cancel booking"
 *  2. App calls cancel_booking RPC (no override) via useCancelBookingPolicy
 *  3a. { ok: true } → queries invalidated, navigate back
 *  3b. { code: 'LATE_CANCEL' } → bottom sheet shown with policy + fee
 *        "Go Back"       — dismiss, booking unchanged
 *        "Cancel Anyway" — re-calls RPC with override=true
 */

import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FamilyBooking } from '@/api/bookings';
import { useBooking } from '@/hooks/useBooking';
import { useCancelBookingPolicy } from '@/hooks/useCancelBookingPolicy';
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

function formatFeeDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

type LateSheet = {
  window_hours: number;
  fee_cents: number;
  pendingReason?: string;
};

export default function BookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MeStackParamList, 'BookingDetail'>>();
  const { bookingId } = route.params;

  const { data: booking, isPending, isError, error, refetch } = useBooking(bookingId);
  const cancelMut = useCancelBookingPolicy();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lateSheet, setLateSheet] = useState<LateSheet | null>(null);

  const cancellable = useMemo(() => (booking ? isCancellable(booking) : false), [booking]);

  const performCancel = (reason?: string, override = false) => {
    setSubmitError(null);
    cancelMut.mutate(
      { bookingId, reason, override },
      {
        onSuccess: (result) => {
          if ('ok' in result && result.ok) {
            navigation.goBack();
            return;
          }
          if ('code' in result && result.code === 'LATE_CANCEL') {
            setLateSheet({
              window_hours: (result as { window_hours: number }).window_hours,
              fee_cents: (result as { fee_cents: number }).fee_cents,
              pendingReason: reason,
            });
            return;
          }
          if ('code' in result) {
            setSubmitError((result as { message: string }).message);
          }
        },
        onError: (err) => setSubmitError(errorMessage(err)),
      },
    );
  };

  const handleCancelPress = () => {
    if (Platform.OS === 'ios' && typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Reason (optional)',
        'Let your coach know why if you want.',
        [
          { text: 'Skip', style: 'cancel', onPress: () => performCancel() },
          { text: 'Send', onPress: (text?: string) => performCancel(text) },
        ],
        'plain-text',
      );
    } else {
      performCancel();
    }
  };

  const handleCancelAnyway = () => {
    const reason = lateSheet?.pendingReason;
    setLateSheet(null);
    performCancel(reason, true);
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

      {/* Late cancellation warning bottom sheet */}
      <Modal
        visible={lateSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setLateSheet(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setLateSheet(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Cancellation Policy</Text>
            <Text style={styles.sheetBody}>
              This booking is within the{' '}
              <Text style={styles.sheetEmphasis}>
                {lateSheet?.window_hours}-hour cancellation window
              </Text>
              .
              {lateSheet?.fee_cents && lateSheet.fee_cents > 0
                ? ` A late cancellation fee of ${formatFeeDollars(lateSheet.fee_cents)} may be collected at the front desk.`
                : ' No fee applies, but your coach has limited time to fill the slot.'}
            </Text>
            <Text style={styles.sheetSubtext}>
              You can go back and keep this booking, or cancel it anyway.
            </Text>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.sheetBackBtn}
                onPress={() => setLateSheet(null)}
              >
                <Text style={styles.sheetBackText}>Go Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetCancelBtn, cancelMut.isPending && styles.cancelBtnDisabled]}
                onPress={handleCancelAnyway}
                disabled={cancelMut.isPending}
              >
                {cancelMut.isPending ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Text style={styles.sheetCancelText}>Cancel Anyway</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  // Late cancel bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.darker,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing['3xl'],
  },
  sheetTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginBottom: spacing.lg,
  },
  sheetBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  sheetEmphasis: {
    fontFamily: fontFamilies.interBold,
    color: colors.danger,
  },
  sheetSubtext: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginBottom: spacing['4xl'],
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  sheetBackBtn: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  sheetBackText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
  },
  sheetCancelBtn: {
    flex: 1,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  sheetCancelText: {
    color: colors.danger,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
