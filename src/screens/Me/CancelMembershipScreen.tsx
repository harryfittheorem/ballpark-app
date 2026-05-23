/**
 * CancelMembershipScreen — shows the computed effective cancel date BEFORE
 * the parent confirms, so they know exactly when billing stops.
 *
 * Effective date = MAX(today + notice_days, next_billing_at)
 * This mirrors the SQL logic in cancel_membership() exactly.
 *
 * The RPC then sets cancel_requested_at + cancel_effective_at (≥ notice_days
 * from now) without immediately cancelling the Stripe subscription.
 * The actual cancellation happens via the daily pg_cron job that invokes
 * process-membership-cancellations when cancel_effective_at <= NOW().
 */

import { useNavigation } from '@react-navigation/native';
import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cancelMembershipRpc, type CancelMembershipResult } from '@/api/bookings';
import { getTenantConfig } from '@/api/tenantConfig';
import { supabase } from '@/lib/supabase';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Compute the expected effective cancellation date client-side.
 * Mirrors: GREATEST(now() + notice_days, COALESCE(next_billing_at, now() + notice_days))
 */
function computeEffectiveDate(noticeDays: number, nextBillingAt: string | null): Date {
  const fromNotice = new Date();
  fromNotice.setDate(fromNotice.getDate() + noticeDays);

  if (!nextBillingAt) return fromNotice;
  const billing = new Date(nextBillingAt);
  return billing > fromNotice ? billing : fromNotice;
}

type Membership = {
  id: string;
  plan_name: string;
  plan_type: string;
  status: string;
  next_billing_at: string | null;
  cancel_requested_at: string | null;
  cancel_effective_at: string | null;
};

export default function CancelMembershipScreen() {
  const navigation = useNavigation();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [noticeDays, setNoticeDays] = useState<number>(30);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ cancel_effective_at: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [membershipResult, config] = await Promise.all([
          (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
            .from('memberships')
            .select(
              'id, plan_name, plan_type, status, next_billing_at, cancel_requested_at, cancel_effective_at',
            )
            .eq('status', 'active')
            .maybeSingle(),
          getTenantConfig().catch(() => null),
        ]);

        if (membershipResult.error) throw membershipResult.error;
        setMembership(membershipResult.data as Membership | null);

        if (config?.membership_cancel_notice_days) {
          setNoticeDays(config.membership_cancel_notice_days);
        }
      } catch (err) {
        setLoadError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConfirm = async () => {
    if (!membership) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result: CancelMembershipResult = await cancelMembershipRpc(membership.id);
      if ('ok' in result && result.ok) {
        setDone({ cancel_effective_at: result.cancel_effective_at });
        return;
      }
      if ('code' in result) {
        if (result.code === 'ALREADY_REQUESTED' && result.cancel_effective_at) {
          setDone({ cancel_effective_at: result.cancel_effective_at });
          return;
        }
        setSubmitError(result.message);
      }
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load membership</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!membership) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.title}>No active membership</Text>
          <Text style={styles.body}>
            You don&apos;t have an active recurring membership to cancel. Contact staff if
            you need help.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.successIcon}>
            <Text style={styles.successEmoji}>✓</Text>
          </View>
          <Text style={styles.title}>Cancellation Requested</Text>
          <Text style={styles.body}>
            Your membership is scheduled to cancel on{' '}
            <Text style={styles.emphasis}>{formatDate(done.cancel_effective_at)}</Text>.
          </Text>
          <Text style={styles.bodyMuted}>
            You&apos;ll keep full access and billing will continue until that date. No
            further action is required.
          </Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const alreadyRequested =
    membership.cancel_requested_at !== null && membership.cancel_effective_at !== null;

  // Compute the effective date to show BEFORE the parent confirms.
  // If already requested, use the stored value; otherwise compute it.
  const effectiveDate = alreadyRequested && membership.cancel_effective_at
    ? new Date(membership.cancel_effective_at)
    : computeEffectiveDate(noticeDays, membership.next_billing_at);

  const effectiveDateStr = formatDate(effectiveDate);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Cancel Membership</Text>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Plan</Text>
            <Text style={styles.cardValue}>{membership.plan_name}</Text>
          </View>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Type</Text>
            <Text style={styles.cardValue}>
              {membership.plan_type === 'eft' ? 'Monthly EFT' : membership.plan_type.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.cardRow, styles.cardRowLast]}>
            <Text style={styles.cardLabel}>Cancels on</Text>
            <Text style={[styles.cardValue, styles.emphasisValue]}>
              {effectiveDateStr}
            </Text>
          </View>
        </View>

        {alreadyRequested ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              You&apos;ve already requested a cancellation. Your membership stays active
              and billing continues until{' '}
              <Text style={styles.emphasis}>{effectiveDateStr}</Text>.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>Before you cancel</Text>
              <Text style={styles.warningBody}>
                You&apos;ll be charged until{' '}
                <Text style={styles.emphasisDanger}>{effectiveDateStr}</Text>
                {membership.next_billing_at
                  ? ' — the later of your next billing date and the required notice period.'
                  : ` — ${noticeDays} days from today.`}
                {'\n\n'}
                Your access remains active until that date.
              </Text>
            </View>

            {submitError ? (
              <Text style={styles.inlineError}>{submitError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              onPress={() => void handleConfirm()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.confirmText}>Confirm Cancellation</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>
            {alreadyRequested ? 'Done' : 'Keep Membership'}
          </Text>
        </TouchableOpacity>
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

  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing['3xl'],
    marginTop: spacing['4xl'],
  },
  successEmoji: {
    fontSize: 32,
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
  },

  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  bodyMuted: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing['4xl'],
  },
  emphasis: {
    fontFamily: fontFamilies.interBold,
    color: colors.gold,
  },
  emphasisDanger: {
    fontFamily: fontFamilies.interBold,
    color: colors.danger,
  },

  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardRowLast: {
    borderBottomWidth: 0,
  },
  cardLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  cardValue: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  emphasisValue: {
    color: colors.gold,
  },

  warningBox: {
    backgroundColor: `${colors.danger}18`,
    borderColor: `${colors.danger}44`,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  warningTitle: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  warningBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 20,
  },

  infoBox: {
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  infoBoxText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 20,
  },

  inlineError: {
    color: colors.danger,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },

  confirmBtn: {
    backgroundColor: `${colors.danger}22`,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    color: colors.danger,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },

  backBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  backBtnText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
  },

  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  errorBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
  },
});
