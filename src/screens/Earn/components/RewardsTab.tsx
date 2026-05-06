import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/earn';
import { useProducts } from '@/hooks/useProducts';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import PointsBadge from './PointsBadge';
import ProductCard from './ProductCard';

export default function RewardsTab({
  pointsBalance,
  onSelect,
}: {
  pointsBalance: number;
  onSelect: (p: Product) => void;
}) {
  const { data, isPending, isError, error } = useProducts();

  if (isPending) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{(error as Error)?.message ?? 'Could not load rewards'}</Text>
      </View>
    );
  }

  const rewards = (data ?? []).filter((p) => p.is_redeemable);

  return (
    <FlatList
      data={rewards}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Your balance</Text>
            <Text style={styles.headerValue}>{pointsBalance.toLocaleString()} pts</Text>
          </View>
          <PointsBadge points={pointsBalance} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No rewards available yet.</Text>}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          mode="redeem"
          pointsBalance={pointsBalance}
          onPress={() => onSelect(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
    gap: spacing.lg,
  },
  row: {
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  headerLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  empty: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    paddingVertical: spacing['5xl'],
  },
});
