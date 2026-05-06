import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { useProducts } from '@/hooks/useProducts';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import ProductCard from './ProductCard';

export default function StoreTab() {
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
      ListHeaderComponent={
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Front-desk pickup</Text>
          <Text style={styles.bannerBody}>
            Card checkout is coming soon. Tap an item to reserve it and pay at the desk.
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No store items yet.</Text>}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          mode="store"
          pointsBalance={0}
          onPress={() =>
            Alert.alert(
              item.name,
              'Card checkout ships in v0.5+. For now, mention this item at the front desk.',
            )
          }
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
  banner: {
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  bannerTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  bannerBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
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
