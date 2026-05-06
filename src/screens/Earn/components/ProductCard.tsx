import { Coins, ShoppingBag } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { Product } from '@/api/earn';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function ProductCard({
  product,
  mode,
  pointsBalance,
  onPress,
}: {
  product: Product;
  mode: 'redeem' | 'store';
  pointsBalance: number;
  onPress: () => void;
}) {
  const showPoints = mode === 'redeem';
  const canAfford =
    !showPoints || (product.points_cost !== null && pointsBalance >= product.points_cost);
  const soldOut = product.inventory_count !== null && product.inventory_count <= 0;
  const disabled = soldOut || (showPoints && !canAfford);

  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.thumb}>
        {showPoints ? (
          <Coins size={28} color={colors.gold} />
        ) : (
          <ShoppingBag size={28} color={colors.gold} />
        )}
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.category}>{product.category}</Text>
      <View style={styles.priceRow}>
        {showPoints && product.points_cost !== null ? (
          <Text style={styles.priceGold}>{product.points_cost.toLocaleString()} PTS</Text>
        ) : null}
        {!showPoints && product.dollar_price_cents !== null ? (
          <Text style={styles.priceGold}>
            ${(product.dollar_price_cents / 100).toFixed(2)}
          </Text>
        ) : null}
      </View>
      {soldOut ? <Text style={styles.tag}>SOLD OUT</Text> : null}
      {showPoints && !canAfford && !soldOut ? (
        <Text style={styles.tagMuted}>NEED {product.points_cost! - pointsBalance} MORE</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    minHeight: 180,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    marginBottom: spacing.xs,
  },
  category: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  priceRow: {
    marginTop: 'auto',
  },
  priceGold: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    letterSpacing: tracking.wide,
  },
  tag: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    color: colors.danger,
    letterSpacing: tracking.wide,
  },
  tagMuted: {
    marginTop: spacing.xs,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },
});
