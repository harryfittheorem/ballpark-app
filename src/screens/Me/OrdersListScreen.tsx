/**
 * OrdersListScreen — chronological history of every order (redemption or
 * purchase) the family has placed. Shows the redemption code for ordered
 * items so the parent can present it at the front desk.
 */

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OrderWithProduct } from '@/api/earn';
import { useOrders } from '@/hooks/useOrders';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

const STATUS_LABEL: Record<string, string> = {
  ordered: 'Ordered',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const h24 = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${m} ${d.getDate()} · ${h12}:${min} ${period}`;
}

function OrderRow({ order }: { order: OrderWithProduct }) {
  const isPoints = order.payment_method === 'points';
  const cost = isPoints
    ? `${order.amount_paid_points?.toLocaleString() ?? 0} pts`
    : order.amount_paid_cents !== null
      ? `$${(order.amount_paid_cents / 100).toFixed(2)}`
      : '';
  const productName = order.product?.name ?? 'Unknown product';
  const kidName = order.kid ? `${order.kid.first_name}` : '';
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const showCode = order.status === 'ordered';

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.productName}>{productName}</Text>
        <View style={[styles.badge, order.status === 'fulfilled' && styles.badgeFulfilled]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {kidName ? `${kidName} · ` : ''}
        {cost} · {formatDateTime(order.created_at)}
      </Text>
      {showCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>Front-desk code</Text>
          <Text style={styles.codeValue}>{order.redemption_code}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function OrdersListScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } = useOrders();

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }
  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load orders</Text>
          <Text style={styles.errorMsg}>{errorMessage(error)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={(data ?? []).length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        renderItem={({ item }) => <OrderRow order={item} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyMsg}>
              Redeem a reward in the Earn tab and it will show up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  listContent: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  row: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  productName: {
    flex: 1,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginRight: spacing.lg,
  },
  badge: {
    backgroundColor: colors.darkest,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
  },
  badgeFulfilled: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  badgeText: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
  codeBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.darkest,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
  },
  codeLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: 2,
  },
  codeValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    letterSpacing: 4,
  },
  emptyBox: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  emptyMsg: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  errorMsg: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
  },
});
