/**
 * EarnScreen — v0.5 entry point. In-screen segmented switcher between the
 * four Earn surfaces (Rewards / Store / Ranks / Earn rules + history).
 *
 * v0.5 enforces one kid per family in the UI (see replit.md), so the points
 * balance + ledger queries pin to `kids[0]`. When the family has no kid,
 * Rewards still renders with balance=0 and the user-facing copy points
 * them at the Add-Kid flow on Home.
 */

import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Product } from '@/api/earn';
import { useFamily } from '@/hooks/useFamily';
import type { EarnStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import EarnRulesTab from './components/EarnRulesTab';
import RanksTab from './components/RanksTab';
import RewardsTab from './components/RewardsTab';
import StoreTab from './components/StoreTab';
import SubTabBar, { type SubTabKey } from './components/SubTabBar';

type Nav = EarnStackScreenProps<'EarnHome'>['navigation'];

export default function EarnScreen() {
  const navigation = useNavigation<Nav>();
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  const [tab, setTab] = useState<SubTabKey>('rewards');

  const handleSelect = (p: Product) => {
    if (!kid) return;
    navigation.navigate('RewardRedeem', { productId: p.id, kidId: kid.id });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Earn</Text>
        <Text style={styles.subtitle}>Points, rewards, store, and ranks</Text>
      </View>
      <SubTabBar value={tab} onChange={setTab} />
      <View style={styles.body}>
        {tab === 'rewards' && (
          <RewardsTab pointsBalance={kid?.points_balance ?? 0} onSelect={handleSelect} />
        )}
        {tab === 'store' && <StoreTab />}
        {tab === 'ranks' && <RanksTab ownKidIds={kid ? [kid.id] : []} />}
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
  body: { flex: 1 },
});
