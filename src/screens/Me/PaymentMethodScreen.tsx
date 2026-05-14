/**
 * PaymentMethodScreen
 *
 * Allows a parent to add or update their saved payment method for
 * recurring membership subscription billing. Uses the Stripe
 * SetupIntent flow via stripe-react-native's payment sheet.
 *
 * Connect account context:
 * The stripe-setup-intent edge function creates the Customer and SetupIntent
 * on the location's connected Stripe account (via Stripe-Account header) and
 * returns stripe_account_id alongside the client secret. We wrap the payment
 * sheet presentation in a nested StripeProvider with that stripeAccountId so
 * the SDK makes calls against the correct connected account — matching the
 * server-side scoping exactly.
 */

import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { CreditCard, CheckCircle2 } from 'lucide-react-native';
import { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createSetupIntent, type SetupIntentResult } from '@/api/stripe';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

// Platform publishable key — the same key used at the app root StripeProvider.
// The nested StripeProvider overrides only stripeAccountId; the publishable key
// itself remains the platform key (Stripe Connect requirement).
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

type Props = MeStackScreenProps<'PaymentMethod'>;

// ── Inner presenter component ─────────────────────────────────────────────────
// Rendered inside a nested StripeProvider so useStripe() is bound to the
// correct connected account. Auto-initialises and presents the payment sheet
// on mount, then signals success/error to the parent via callbacks.

type PresenterProps = {
  setup: SetupIntentResult;
  onSuccess: () => void;
  onCancel: () => void;
  onError: (msg: string) => void;
};

function PaymentSheetPresenter({ setup, onSuccess, onCancel, onError }: PresenterProps) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [presenting, setPresentingState] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const { error: initError } = await initPaymentSheet({
          setupIntentClientSecret: setup.setupIntentClientSecret,
          customerId: setup.customerId,
          customerEphemeralKeySecret: setup.ephemeralKeySecret,
          merchantDisplayName: 'Ballpark Sports',
          allowsDelayedPaymentMethods: false,
          style: 'alwaysDark',
        });

        if (initError) throw new Error(initError.message);
        if (!mounted) return;

        const { error: presentError } = await presentPaymentSheet();
        if (!mounted) return;

        if (presentError) {
          if (presentError.code === 'Canceled') {
            onCancel();
          } else {
            onError(presentError.message);
          }
        } else {
          onSuccess();
        }
      } catch (err) {
        if (mounted) onError(errorMessage(err));
      } finally {
        if (mounted) setPresentingState(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [initPaymentSheet, presentPaymentSheet, setup, onSuccess, onCancel, onError]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {presenting && <ActivityIndicator color={colors.gold} size="large" />}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function PaymentMethodScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<'idle' | 'fetching' | 'presenting' | 'success'>('idle');
  const [setupData, setSetupData] = useState<SetupIntentResult | null>(null);

  const handleAddCard = useCallback(async () => {
    try {
      setPhase('fetching');
      const data = await createSetupIntent();
      setSetupData(data);
      setPhase('presenting');
    } catch (err) {
      setPhase('idle');
      Alert.alert('Could not start card setup', errorMessage(err));
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setPhase('success');
    setSetupData(null);
  }, []);

  const handleCancel = useCallback(() => {
    setPhase('idle');
    setSetupData(null);
  }, []);

  const handleError = useCallback((msg: string) => {
    setPhase('idle');
    setSetupData(null);
    Alert.alert('Could not save card', msg);
  }, []);

  // ── Presenting phase: nested StripeProvider with connected account context ──
  if (phase === 'presenting' && setupData) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          stripeAccountId={setupData.stripeAccountId}
        >
          <PaymentSheetPresenter
            setup={setupData}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            onError={handleError}
          />
        </StripeProvider>
      </SafeAreaView>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (phase === 'success') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <View style={styles.successBlock}>
            <View style={styles.iconCircle}>
              <CheckCircle2 size={40} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Card Saved</Text>
            <Text style={styles.successSubtitle}>
              Your payment method is saved and will be used for monthly membership billing.
            </Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Idle / fetching state ─────────────────────────────────────────────────
  const loading = phase === 'fetching';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <CreditCard size={36} color={colors.gold} />
          </View>
          <Text style={styles.title}>Add Payment Method</Text>
          <Text style={styles.subtitle}>
            Save a credit or debit card for automatic monthly membership billing.
            Your card will only be charged on your renewal date.
          </Text>

          <View style={styles.infoCard}>
            {[
              { label: 'When you\'ll be charged', value: 'On your membership renewal date each month' },
              { label: 'What you\'ll be charged', value: 'Your current membership plan rate' },
              { label: 'Failed payments', value: 'Stripe retries automatically; you\'ll get an email if action is needed' },
            ].map((row, i) => (
              <View key={i} style={[styles.infoRow, i > 0 && styles.infoRowBorder]}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.addBtn, loading && styles.addBtnDisabled]}
            onPress={handleAddCard}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} size="small" />
            ) : (
              <Text style={styles.addBtnText}>Add Card</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.secureNote}>
            Secured by Stripe · Your card details are never stored on our servers
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.darkest,
  },
  container: {
    flex: 1,
    padding: spacing['3xl'],
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['4xl'],
    paddingHorizontal: spacing.lg,
  },
  infoCard: {
    width: '100%',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['4xl'],
  },
  infoRow: {
    paddingVertical: spacing.lg,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 20,
  },
  addBtn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  addBtnDisabled: {
    opacity: 0.7,
  },
  addBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.dark,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  secureNote: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  successBlock: {
    alignItems: 'center',
  },
  successTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  successSubtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['4xl'],
    paddingHorizontal: spacing.lg,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.dark,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
