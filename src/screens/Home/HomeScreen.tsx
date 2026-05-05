import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme';

import HomeHeader from './components/HomeHeader';
import SectionPlaceholder from './components/SectionPlaceholder';
import { styles } from './styles';

const SECTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'hero', label: 'Hero card placeholder' },
  { key: 'stats', label: 'Stats placeholder' },
  { key: 'coachVideo', label: 'Coach video placeholder' },
  { key: 'upcoming', label: 'Upcoming session placeholder' },
  { key: 'quickActions', label: 'Quick actions placeholder' },
];

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        {SECTIONS.map((s) => (
          <View key={s.key} style={styles.section}>
            <SectionPlaceholder label={s.label} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
