import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { Product } from '@/api/earn';
import { useProducts } from '@/hooks/useProducts';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import ProductCard from './ProductCard';

type Props = {
  onBuyWithCard: (product: Product) => void;
};

export default function StoreTab({ onBuyWithCard }: Props) {
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
        <Text style={styles.errorText}>{(error as Error)?.message ?? 'Could not load store'}</Text>
      </View>
    );
  }

  const items = (data ?? []).filter((p) => p.is_purchasable);

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={styles.list}
      columnWrapperStyle={styles.row}
      ListEmptyComponent={<Text style={styles.empty}>No store items yet.</Text>}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          mode="store"
          pointsBalance={0}
          onPress={() => onBuyWithCard(item)}
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
  row: { gap: spacing.lg },
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
