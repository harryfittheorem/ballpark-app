/**
 * RewardsScreen — task #119.
 *
 * Hosts the three "spend points" surfaces previously buried under the
 * Earn tab: Rewards (point-only redemptions), Store (purchase-only /
 * dual-priced items), and Earn rules + ledger history. Ranks was
 * promoted to its own top-level tab.
 *
 * The component shape mirrors the old EarnScreen so the existing
 * RewardsTab / StoreTab / EarnRulesTab components keep working unchanged.
 */

import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Product } from '@/api/earn';
import EarnRulesTab from '@/screens/Earn/components/EarnRulesTab';
import RewardsTab from '@/screens/Earn/components/RewardsTab';
import StoreTab from '@/screens/Earn/components/StoreTab';
import { useFamily } from '@/hooks/useFamily';
import type { RewardsStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Nav = RewardsStackScreenProps<'RewardsHome'>['navigation'];

type SubTab = 'rewards' | 'store' | 'earn';
const TABS: { key: SubTab; label: string }[] = [
  { key: 'rewards', label: 'Rewards' },
  { key: 'store', label: 'Store' },
  { key: 'earn', label: 'Rules' },
];

export default function RewardsScreen() {
  const navigation = useNavigation<Nav>();
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  const [tab, setTab] = useState<SubTab>('rewards');

  const handleSelect = (p: Product) => {
    if (!kid) return;
    navigation.navigate('RewardRedeem', { productId: p.id, kidId: kid.id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Rewards</Text>
        <Text style={styles.subtitle}>Redeem points, browse the store, and see how you earn</Text>
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
          <RewardsTab pointsBalance={kid?.points_balance ?? 0} onSelect={handleSelect} />
        )}
        {tab === 'store' && <StoreTab />}
        {tab === 'earn' && <EarnRulesTab kidId={kid?.id ?? null} />}
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
    fontSize: fontSizes.md,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  pillTextActive: { color: colors.dark },
  body: { flex: 1 },
});
