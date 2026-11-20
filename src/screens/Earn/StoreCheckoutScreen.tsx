/**
 * StoreCheckoutScreen — dual-path checkout for store items.
 *
 * Supports two payment methods where available:
 *   • Pay with Points — uses the existing `redeem_reward_for_kid` RPC,
 *     same as RewardRedeemScreen. Available when product.points_cost is set
 *     and the kid has sufficient balance.
 *   • Pay with Card  — Stripe payment sheet via stripe-create-payment-intent
 *     Edge Function. Available when product.dollar_price_cents is set AND
 *     the family's primary location has a connected Stripe account.
 *
 * Location pre-check: the screen queries the location's stripe_onboarding_status
 * before rendering. If not connected, the card button is disabled with a clear
 * explanation, so parents know to pay at the front desk instead.
 *
 * Order lifecycle (card path):
 *   payment_pending → fulfilled   (payment_intent.succeeded webhook)
 *   payment_pending → payment_failed  (payment_intent.payment_failed)
 *   payment_pending → cancelled   (payment_intent.canceled — sheet dismissed)
 *
 * Note: @stripe/stripe-react-native requires a custom dev build (EAS Build)
 * or Expo Development Build — it is not available in standard Expo Go.
 */

import {
  useStripe,
} from '@stripe/stripe-react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CheckCircle2, Coins, CreditCard, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createCardPaymentIntent } from '@/api/stripe';
import { Button } from '@/components/ui/Button';
import { useFamily } from '@/hooks/useFamily';
import { useProducts } from '@/hooks/useProducts';
import { useRedeemReward } from '@/hooks/useRedeemReward';
import { supabase } from '@/lib/supabase';
import type { EarnStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = EarnStackScreenProps<'StoreCheckout'>;

type LocationStatus = 'loading' | 'connected' | 'not_connected';

type SuccessData = {
  redemptionCode: string;
  amountCents: number | null;
  amountPoints: number | null;
  newBalance: number | null;
  method: 'card' | 'points';
};

export default function StoreCheckoutScreen({ route, navigation }: Props) {
  const { productId, kidId } = route.params;
  const { family, kids } = useFamily();
  const { data: products, isPending } = useProducts();

  const product = useMemo(
    () => (products ?? []).find((p) => p.id === productId) ?? null,
    [products, productId],
  );
  const kid = kids.find((k) => k.id === kidId) ?? null;
  const pointsBalance = kid?.points_balance ?? 0;

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const redeem = useRedeemReward();

  const [locationStatus, setLocationStatus] = useState<LocationStatus>('loading');
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [cardErrorMsg, setCardErrorMsg] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // ── Pre-check: does this family's location have a connected Stripe account? ─
  useEffect(() => {
    async function checkLocationStatus() {
      const locationId = family?.primary_location_id;
      if (!locationId) {
        setLocationStatus('not_connected');
        return;
      }

      // stripe_onboarding_status was added post-generated-types; use the
      // untyped client cast per project convention (not `any`).
      const { data, error } = await (supabase as SupabaseClient)
        .from('locations')
        .select('stripe_account_id, stripe_onboarding_status')
        .eq('id', locationId)
        .single<{ stripe_account_id: string | null; stripe_onboarding_status: string | null }>();

      if (error || !data) {
        setLocationStatus('not_connected');
        return;
      }

      if (
        data.stripe_onboarding_status === 'connected' &&
        data.stripe_account_id
      ) {
        setLocationStatus('connected');
      } else {
        setLocationStatus('not_connected');
      }
    }

    if (family !== null) {
      void checkLocationStatus();
    }
  }, [family]);

  // ── Pay with Points ──────────────────────────────────────────────────────

  const handlePayWithPoints = useCallback(async () => {
    if (!product) return;
    try {
      const res = await redeem.mutateAsync({ kidId, productId });
      setSuccessData({
        redemptionCode: res.redemptionCode,
        amountCents: null,
        amountPoints: product.points_cost,
        newBalance: res.newBalance,
        method: 'points',
      });
    } catch {
      // surfaced via redeem.error
    }
  }, [product, kidId, productId, redeem]);

  // ── Pay with Card ────────────────────────────────────────────────────────

  const handlePayWithCard = useCallback(async () => {
    if (!product || !kid) return;
    setIsCardLoading(true);
    setCardErrorMsg(null);

    try {
      // 1. Get client_secret, customer context, and ephemeral key from Edge Function.
      //    The Edge Function also inserts an order with status='payment_pending'.
      const result = await createCardPaymentIntent({
        productId: product.id,
        kidId: kid.id,
      });

      // 2. Initialise the Stripe payment sheet with customer context so saved
      //    payment methods are surfaced on subsequent purchases.
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Clubhouse by Infinite Hitting',
        paymentIntentClientSecret: result.clientSecret,
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKeySecret,
        style: 'alwaysDark',
        appearance: {
          colors: {
            primary: '#E3A020',
            background: '#1A1A1A',
            componentBackground: '#242424',
            componentBorder: '#333333',
            componentDivider: '#333333',
            primaryText: '#FFFFFF',
            secondaryText: '#AAAAAA',
            componentText: '#FFFFFF',
            placeholderText: '#888888',
            icon: '#E3A020',
            error: '#FF4444',
          },
        },
      });

      if (initError) {
        setCardErrorMsg(initError.localizedMessage ?? initError.message ?? 'Payment setup failed');
        return;
      }

      // 3. Present the Stripe payment sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User cancelled — order stays payment_pending until webhook fires
          // payment_intent.canceled and sets it to 'cancelled'. No-op in UI.
          return;
        }
        setCardErrorMsg(presentError.localizedMessage ?? presentError.message ?? 'Payment failed');
        return;
      }

      // 4. Payment sheet confirmed — show success.
      //    Webhook will set order to 'ordered' asynchronously (payment_pending → ordered).
      //    Staff then scans the QR code at the front desk → mark_redemption_fulfilled → 'fulfilled'.
      setSuccessData({
        redemptionCode: result.redemptionCode,
        amountCents: result.amountCents,
        amountPoints: null,
        newBalance: null,
        method: 'card',
      });
    } catch (err) {
      setCardErrorMsg(errorMessage(err));
    } finally {
      setIsCardLoading(false);
    }
  }, [product, kid, initPaymentSheet, presentPaymentSheet]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (isPending || (locationStatus === 'loading' && family === null)) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Product not found</Text>
          <Button label="Close" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (successData) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={56} color={colors.gold} />
          </View>
          <Text style={styles.successTitle}>
            {successData.method === 'card' ? 'Payment successful!' : 'You did it!'}
          </Text>
          <Text style={styles.successSubtitle}>
            Show this code at the front desk to claim your item:
          </Text>
          <View style={styles.qrFrame}>
            <QRCode
              value={successData.redemptionCode}
              size={180}
              color={colors.dark}
              backgroundColor={colors.cream}
            />
          </View>
          <Text style={styles.codeBlock}>{successData.redemptionCode}</Text>
          <Text style={styles.successProduct}>{product.name}</Text>
          {successData.method === 'card' && successData.amountCents !== null ? (
            <Text style={styles.successMeta}>
              Paid:{' '}
              <Text style={styles.successMetaVal}>
                ${(successData.amountCents / 100).toFixed(2)}
              </Text>
            </Text>
          ) : null}
          {successData.method === 'points' && successData.amountPoints !== null ? (
            <Text style={styles.successMeta}>
              Spent:{' '}
              <Text style={styles.successMetaVal}>
                {successData.amountPoints.toLocaleString()} pts
              </Text>
            </Text>
          ) : null}
          {successData.newBalance !== null ? (
            <Text style={styles.successBalance}>
              New balance:{' '}
              <Text style={styles.successBalanceVal}>
                {successData.newBalance.toLocaleString()} pts
              </Text>
            </Text>
          ) : null}
          <View style={{ height: spacing['5xl'] }} />
          <Button label="Done" onPress={() => navigation.popToTop()} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  // ── Checkout state ────────────────────────────────────────────────────────

  const price = product.dollar_price_cents !== null
    ? `$${(product.dollar_price_cents / 100).toFixed(2)}`
    : null;

  const pointsCost = product.points_cost ?? null;
  const soldOut = product.inventory_count !== null && product.inventory_count <= 0;
  const canAffordPoints = pointsCost !== null && pointsBalance >= pointsCost;
  const cardNotAvailable = locationStatus === 'not_connected';
  const cardLoading = locationStatus === 'loading';

  const hasPoints = pointsCost !== null;
  const hasCard = price !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>Checkout</Text>
          <Button
            label=""
            variant="tertiary"
            tone="muted"
            leftIcon={<X size={20} color={colors.textLight} />}
            onPress={() => navigation.goBack()}
          />
        </View>

        {/* ── Product summary ── */}
        <View style={styles.card}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.description ? (
            <Text style={styles.productDesc}>{product.description}</Text>
          ) : null}
          <View style={styles.divider} />

          {hasCard ? (
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Card price</Text>
              <Text style={styles.linePriceGold}>{price}</Text>
            </View>
          ) : null}

          {hasPoints ? (
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Points cost</Text>
              <View style={styles.lineCost}>
                <Coins size={14} color={colors.gold} />
                <Text style={styles.lineCostText}>
                  {pointsCost!.toLocaleString()} pts
                </Text>
              </View>
            </View>
          ) : null}

          {hasPoints ? (
            <View style={styles.line}>
              <Text style={styles.lineLabel}>Your balance</Text>
              <Text style={styles.lineValue}>{pointsBalance.toLocaleString()} pts</Text>
            </View>
          ) : null}

          {kid ? (
            <View style={styles.line}>
              <Text style={styles.lineLabel}>For</Text>
              <Text style={styles.lineValue}>{kid.first_name}</Text>
            </View>
          ) : null}

          <View style={styles.line}>
            <Text style={styles.lineLabel}>Pickup</Text>
            <Text style={styles.lineValue}>Front desk</Text>
          </View>
        </View>

        {/* ── Location not connected — explain why card is unavailable ── */}
        {cardNotAvailable && hasCard ? (
          <View style={styles.notConnectedBanner}>
            <WifiOff size={20} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={styles.notConnectedText}>
              Card payments are not yet available at this location.
              {hasPoints ? ' You can still pay with points below.' : ' Please pay at the front desk or check back later.'}
            </Text>
          </View>
        ) : null}

        {soldOut ? (
          <Text style={styles.warn}>This item is sold out.</Text>
        ) : null}

        {!canAffordPoints && hasPoints && !hasCard ? (
          <Text style={styles.warn}>
            Not enough points yet — keep training!
          </Text>
        ) : null}

        {redeem.error ? (
          <Text style={styles.warn}>{errorMessage(redeem.error)}</Text>
        ) : null}

        {cardErrorMsg ? (
          <Text style={styles.warn}>{cardErrorMsg}</Text>
        ) : null}

        {/* ── Payment options ── */}
        <View style={styles.actions}>

          {/* Pay with Card */}
          {hasCard ? (
            cardLoading ? (
              <View style={styles.locationLoading}>
                <ActivityIndicator size="small" color={colors.gold} />
                <Text style={styles.locationLoadingText}>Checking payment availability…</Text>
              </View>
            ) : (
              <Button
                label={isCardLoading ? 'Processing…' : `Pay ${price} with Card`}
                leftIcon={
                  <CreditCard
                    size={18}
                    color={cardNotAvailable || soldOut ? colors.textMuted : colors.dark}
                  />
                }
                onPress={handlePayWithCard}
                loading={isCardLoading}
                disabled={soldOut || isCardLoading || cardNotAvailable}
                fullWidth
              />
            )
          ) : null}

          {/* Pay with Points */}
          {hasPoints ? (
            <Button
              label={
                redeem.isPending
                  ? 'Processing…'
                  : `Pay ${pointsCost!.toLocaleString()} pts with Points`
              }
              variant={hasCard ? 'secondary' : 'primary'}
              leftIcon={<Coins size={18} color={canAffordPoints ? colors.gold : colors.textMuted} />}
              onPress={handlePayWithPoints}
              loading={redeem.isPending}
              disabled={!canAffordPoints || soldOut || redeem.isPending}
              fullWidth
            />
          ) : null}

          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>

        <Text style={styles.disclaimer}>
          {hasCard
            ? 'Card details are processed securely by Stripe and never stored on Clubhouse servers.'
            : 'Points redemptions are instant and cannot be reversed.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: {
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
    marginBottom: spacing['2xl'],
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  productName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  productDesc: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  lineLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  lineValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  linePriceGold: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  lineCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lineCostText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
  notConnectedBanner: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  notConnectedText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  warn: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  actions: {
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  locationLoadingText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  disclaimer: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  successWrap: {
    flex: 1,
    padding: spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  successTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  qrFrame: {
    backgroundColor: colors.cream,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing['2xl'],
  },
  codeBlock: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.gold,
    letterSpacing: 6,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['3xl'],
    marginBottom: spacing['2xl'],
  },
  successProduct: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    marginBottom: spacing.sm,
  },
  successMeta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
  successMetaVal: {
    fontFamily: fontFamilies.oswaldBold,
    color: colors.gold,
  },
  successBalance: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  successBalanceVal: {
    fontFamily: fontFamilies.oswaldBold,
    color: colors.gold,
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing['3xl'],
  },
});
