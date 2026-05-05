import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFamily } from '@/hooks/useFamily';
import { colors } from '@/theme';

import CoachVideoCard from './components/CoachVideoCard';
import HeroCard from './components/HeroCard';
import HomeHeader from './components/HomeHeader';
import QuickActionsRow from './components/QuickActionsRow';
import SectionPlaceholder from './components/SectionPlaceholder';
import StatTilesRow from './components/StatTilesRow';
import { styles } from './styles';

const PLACEHOLDER_SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'upcoming', label: 'Upcoming session placeholder' },
];

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { kids } = useFamily();
  const kid = kids[0];

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    // No-op refresh for v0.2 Step 2.4 — real data wiring lands later.
    refreshTimer.current = setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HomeHeader locationName="Dallas N." />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
      >
        {kid ? (
          <>
            <View style={styles.section}>
              <HeroCard
                kidName={`${kid.first_name} ${kid.last_name}`.trim()}
                ageGroup={kid.age_group ?? ''}
                jerseyNumber={kid.jersey_number}
                pointsBalance={kid.points_balance}
                currentStreakDays={kid.current_streak_days}
              />
            </View>
            <View style={styles.section}>
              <StatTilesRow
                pointsBalance={kid.points_balance}
                currentStreakDays={kid.current_streak_days}
              />
            </View>
            <View style={styles.section}>
              <CoachVideoCard coachName="Coach Mike" durationSeconds={154} />
            </View>
          </>
        ) : null}
        {PLACEHOLDER_SECTIONS.map((s) => (
          <View key={s.key} style={styles.section}>
            <SectionPlaceholder label={s.label} />
          </View>
        ))}
        <View style={styles.section}>
          <QuickActionsRow />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
