/**
 * EarnScreen.
 *
 * Re-merges the v0.4 Earn tab: Rewards / Store / Ranks / Rules behind a
 * pill-style sub-tab switcher. Sub-tab body components are unchanged from
 * the v0.5 split (RewardsTab / StoreTab / RanksTab / EarnRulesTab).
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Product } from '@/api/earn';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import KidSwitcherPill from '@/components/ui/KidSwitcherPill';
import type { EarnStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import EarnRulesTab from './components/EarnRulesTab';
import RanksTab from './components/RanksTab';
import RewardsTab from './components/RewardsTab';
import StoreTab from './components/StoreTab';

type Nav = EarnStackScreenProps<'EarnHome'>['navigation'];
type Route = EarnStackScreenProps<'EarnHome'>['route'];

type SubTab = 'rewards' | 'store' | 'ranks' | 'rules';
const TABS: { key: SubTab; label: string }[] = [
  { key: 'rewards', label: 'Rewards' },
  { key: 'store', label: 'Store' },
  { key: 'ranks', label: 'Ranks' },
  { key: 'rules', label: 'Rules' },
];

export default function EarnScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { kid } = useSelectedKid();
  const initial = route.params?.initialSubTab ?? 'rewards';
  const [tab, setTab] = useState<SubTab>(initial);

  useEffect(() => {
    if (route.params?.initialSubTab) setTab(route.params.initialSubTab);
  }, [route.params?.initialSubTab]);

  const handleSelect = (p: Product) => {
    if (!kid) return;
    navigation.navigate('RewardRedeem', { productId: p.id, kidId: kid.id });
  };

  const handleSelectExisting = (orderId: string, productId: string) => {
    if (!kid) return;
    navigation.navigate('RewardRedeem', { productId, kidId: kid.id, existingOrderId: orderId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Earn</Text>
          <KidSwitcherPill />
        </View>
        <Text style={styles.subtitle}>
          Redeem points, browse the store, climb the leaderboard
        </Text>
      </View>

      <View style={styles.bar}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === 'rewards' && (
          <RewardsTab
            pointsBalance={kid?.points_balance ?? 0}
            onSelect={handleSelect}
            onSelectExisting={handleSelectExisting}
          />
        )}
        {tab === 'store' && (
          <StoreTab
            onBuyWithCard={(p) => {
              if (!kid) return;
              navigation.navigate('StoreCheckout', { productId: p.id, kidId: kid.id });
            }}
          />
        )}
        {tab === 'ranks' && <RanksTab ownKidIds={kid ? [kid.id] : []} />}
        {tab === 'rules' && <EarnRulesTab kidId={kid?.id ?? null} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius.full,
    padding: spacing.xs,
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  pillActive: { backgroundColor: colors.gold },
  pillText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  pillTextActive: { color: colors.dark },
  body: { flex: 1 },
});
