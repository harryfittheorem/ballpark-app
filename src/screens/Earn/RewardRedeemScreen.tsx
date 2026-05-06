/**
 * RewardRedeemScreen — confirm + redeem a reward, then surface the
 * server-issued redemption code so the parent can show it at the front
 * desk. The actual spend happens in the `redeem_reward_for_kid` RPC.
 */

import { CheckCircle2, Coins, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useFamily } from '@/hooks/useFamily';
import { useProducts } from '@/hooks/useProducts';
import { useRedeemReward } from '@/hooks/useRedeemReward';
import type { EarnStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = EarnStackScreenProps<'RewardRedeem'>;

export default function RewardRedeemScreen({ route, navigation }: Props) {
  const { productId, kidId } = route.params;
  const { kids } = useFamily();
  const { data: products, isPending } = useProducts();
  const product = useMemo(
    () => (products ?? []).find((p) => p.id === productId) ?? null,
    [products, productId],
  );
  const kid = kids.find((k) => k.id === kidId) ?? null;
  const balance = kid?.points_balance ?? 0;

  const redeem = useRedeemReward();
  const [code, setCode] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const handleRedeem = async () => {
    if (!product) return;
    try {
      const res = await redeem.mutateAsync({ kidId, productId });
      setCode(res.redemptionCode);
      setNewBalance(res.newBalance);
    } catch {
      // Surfaced via redeem.error below.
    }
  };

  if (isPending) {
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
          <Text style={styles.errorTitle}>Reward not found</Text>
          <Button label="Close" variant="secondary" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  // Success state ----------------------------------------------------------
  if (code) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={56} color={colors.gold} />
          </View>
          <Text style={styles.successTitle}>You did it!</Text>
          <Text style={styles.successSubtitle}>Show this code at the front desk to claim:</Text>
          <Text style={styles.codeBlock}>{code}</Text>
          <Text style={styles.successProduct}>{product.name}</Text>
          {newBalance !== null ? (
            <Text style={styles.successBalance}>
              New balance: <Text style={styles.successBalanceVal}>{newBalance.toLocaleString()} pts</Text>
            </Text>
          ) : null}
          <View style={{ height: spacing['5xl'] }} />
          <Button label="Done" onPress={() => navigation.popToTop()} fullWidth />
        </View>
      </SafeAreaView>
    );
  }

  // Confirm state ----------------------------------------------------------
  const canAfford = product.points_cost !== null && balance >= product.points_cost;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>Confirm redemption</Text>
          <Button
            label=""
            variant="tertiary"
            tone="muted"
            leftIcon={<X size={20} color={colors.textLight} />}
            onPress={() => navigation.goBack()}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.description ? (
            <Text style={styles.productDesc}>{product.description}</Text>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.line}>
            <Text style={styles.lineLabel}>Cost</Text>
            <View style={styles.lineCost}>
              <Coins size={14} color={colors.gold} />
              <Text style={styles.lineCostText}>
                {product.points_cost?.toLocaleString() ?? '—'} pts
              </Text>
            </View>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineLabel}>Your balance</Text>
            <Text style={styles.lineValue}>{balance.toLocaleString()} pts</Text>
          </View>
          <View style={styles.line}>
            <Text style={styles.lineLabel}>After redemption</Text>
            <Text style={[styles.lineValue, styles.afterValue]}>
              {(balance - (product.points_cost ?? 0)).toLocaleString()} pts
            </Text>
          </View>
        </View>

        {!canAfford ? (
          <Text style={styles.warn}>
            Not enough points yet — keep training!
          </Text>
        ) : null}

        {redeem.error ? (
          <Text style={styles.warn}>{errorMessage(redeem.error)}</Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Redeem"
            onPress={handleRedeem}
            loading={redeem.isPending}
            disabled={!canAfford}
            fullWidth
          />
          <Button
            label="Cancel"
            variant="secondary"
            onPress={() => navigation.goBack()}
            fullWidth
          />
        </View>
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
  afterValue: {
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
  warn: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
  },
  actions: {
    gap: spacing.lg,
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
  codeBlock: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    color: colors.gold,
    letterSpacing: 6,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['4xl'],
    marginBottom: spacing['2xl'],
  },
  successProduct: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    marginBottom: spacing.lg,
  },
  successBalance: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
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
