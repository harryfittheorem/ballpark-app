/**
 * PaymentMethodScreen
 *
 * Allows a parent to view, add, or replace the saved payment method for
 * recurring membership subscription billing. Uses the Stripe
 * SetupIntent flow via stripe-react-native's payment sheet.
 *
 * States:
 *   loading    — fetching card-on-file from families table
 *   no-card    — no card saved; shows "Add a card" CTA
 *   has-card   — shows brand/last4/expiry; shows "Replace card" CTA
 *   fetching   — creating SetupIntent before presenting PaymentSheet
 *   presenting — PaymentSheet is open (nested StripeProvider scope)
 *   saving     — PaymentSheet confirmed, calling save-payment-method
 *   success    — card saved/replaced; shown briefly before auto-returning
 *
 * Connect account context:
 * The stripe-setup-intent edge function creates the Customer and SetupIntent
 * on the location's connected Stripe account (via Stripe-Account header) and
 * returns stripe_account_id alongside the client secret. We wrap the payment
 * sheet presentation in a nested StripeProvider with that stripeAccountId so
 * the SDK makes calls against the correct connected account.
 */

import { useQueryClient } from '@tanstack/react-query';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import {
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
} from 'lucide-react-native';
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

import {
  createSetupIntent,
  savePaymentMethod,
  getCardOnFile,
  type SetupIntentResult,
  type CardOnFile,
} from '@/api/stripe';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/hooks/useMembership';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

type Props = MeStackScreenProps<'PaymentMethod'>;

// ── Brand icon label helper ───────────────────────────────────────────────────

const BRAND_SHORT: Record<string, string> = {
  Visa: 'VISA',
  Mastercard: 'MC',
  Amex: 'AMEX',
  Discover: 'DISC',
  'Diners Club': 'DC',
  JCB: 'JCB',
  UnionPay: 'UP',
};

function brandLabel(brand: string): string {
  return BRAND_SHORT[brand] ?? brand.toUpperCase().slice(0, 4);
}

// ── Inner presenter component (PaymentSheet) ──────────────────────────────────

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

// ── Card-on-file display ──────────────────────────────────────────────────────

function CardDisplay({ card }: { card: CardOnFile }) {
  const exp = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
  const now = new Date();
  const isExpiringSoon =
    card.expYear === now.getFullYear() && card.expMonth - now.getMonth() <= 2
    || card.expYear < now.getFullYear();

  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.header}>
        <View style={cardStyles.brandBadge}>
          <Text style={cardStyles.brandText}>{brandLabel(card.brand)}</Text>
        </View>
        {isExpiringSoon && (
          <View style={cardStyles.expiringBadge}>
            <Text style={cardStyles.expiringText}>Expiring Soon</Text>
          </View>
        )}
      </View>
      <View style={cardStyles.numberRow}>
        <Text style={cardStyles.dots}>···· ···· ····</Text>
        <Text style={cardStyles.last4}>{card.last4}</Text>
      </View>
      <View style={cardStyles.footer}>
        <View>
          <Text style={cardStyles.footerLabel}>EXPIRES</Text>
          <Text style={cardStyles.footerValue}>{exp}</Text>
        </View>
        <View style={cardStyles.iconRight}>
          <ShieldCheck size={18} color={colors.success} />
          <Text style={cardStyles.securedText}>Secured</Text>
        </View>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  brandBadge: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  brandText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.dark,
    letterSpacing: 1,
  },
  expiringBadge: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderWidth: 1,
    borderColor: '#FFC107',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
  },
  expiringText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: '#FFC107',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    gap: 8,
  },
  dots: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xl,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  last4: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    letterSpacing: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  footerValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  iconRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  securedText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.success,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

type Phase = 'loading' | 'idle' | 'fetching' | 'presenting' | 'saving' | 'success';

export default function PaymentMethodScreen({ navigation }: Props) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<CardOnFile | null>(null);
  const [setupData, setSetupData] = useState<SetupIntentResult | null>(null);
  const { refresh: refreshMembership } = useMembership();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Load card on mount
  useEffect(() => {
    let mounted = true;
    getCardOnFile()
      .then(result => { if (mounted) { setCard(result); setPhase('idle'); } })
      .catch(() => { if (mounted) setPhase('idle'); });
    return () => { mounted = false; };
  }, []);

  const handleAddOrReplace = useCallback(async () => {
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

  // Called when PaymentSheet confirms successfully
  const handleSheetSuccess = useCallback(() => {
    setSetupData(null);
    setPhase('saving');
  }, []);

  const handleCancel = useCallback(() => {
    setPhase('idle');
    setSetupData(null);
  }, []);

  const handleSheetError = useCallback((msg: string) => {
    setPhase('idle');
    setSetupData(null);
    Alert.alert('Could not save card', msg);
  }, []);

  // After sheet closes with success, call save-payment-method to persist + get card details.
  // Also refresh the membership so the payment_failed_at banner clears immediately.
  useEffect(() => {
    if (phase !== 'saving') return;
    let mounted = true;

    savePaymentMethod()
      .then(result => {
        if (!mounted) return;
        setCard(result);
        setPhase('success');
        // Refresh membership in background — clears payment_failed_at banner.
        void refreshMembership();
        // Invalidate the family query so ProfileScreen's card row shows the
        // new card details immediately without requiring the parent to leave
        // and return to the Me tab.
        if (user?.id) {
          void queryClient.invalidateQueries({ queryKey: ['family', user.id] });
        }
      })
      .catch(err => {
        if (!mounted) return;
        setPhase('idle');
        Alert.alert(
          'Card setup issue',
          `Your card was captured by Stripe but we could not confirm the details: ${errorMessage(err)}. Please contact support if the issue persists.`,
        );
      });

    return () => { mounted = false; };
  }, [phase, refreshMembership]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Presenting PaymentSheet ───────────────────────────────────────────────
  if (phase === 'presenting' && setupData) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          stripeAccountId={setupData.stripeAccountId}
        >
          <PaymentSheetPresenter
            setup={setupData}
            onSuccess={handleSheetSuccess}
            onCancel={handleCancel}
            onError={handleSheetError}
          />
        </StripeProvider>
      </SafeAreaView>
    );
  }

  // ── Saving (after sheet closed) ───────────────────────────────────────────
  if (phase === 'saving') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={[styles.subtitle, { marginTop: spacing['2xl'] }]}>
            Saving your card…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (phase === 'success' && card) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <CheckCircle2 size={40} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Card Saved</Text>
            <Text style={styles.subtitle}>
              {card.brand} ending in {card.last4} is now on file for monthly membership billing.
            </Text>
            <CardDisplay card={card} />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Idle: card on file ────────────────────────────────────────────────────
  if (card) {
    const loading = phase === 'fetching';
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconCircle}>
              <CreditCard size={36} color={colors.gold} />
            </View>
            <Text style={styles.title}>Payment Method</Text>
            <Text style={styles.subtitle}>
              This card is charged automatically on your membership renewal date each month.
            </Text>

            <CardDisplay card={card} />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleAddOrReplace}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.dark} size="small" />
              ) : (
                <View style={styles.btnRow}>
                  <RefreshCw size={16} color={colors.dark} />
                  <Text style={styles.primaryBtnText}>Replace Card</Text>
                </View>
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

  // ── Idle: no card on file ─────────────────────────────────────────────────
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
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAddOrReplace}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.dark} size="small" />
            ) : (
              <View style={styles.btnRow}>
                <PlusCircle size={16} color={colors.dark} />
                <Text style={styles.primaryBtnText}>Add Card</Text>
              </View>
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
  successTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing['3xl'],
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
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: {
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
});
