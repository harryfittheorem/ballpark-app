import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { upcomingSessionKey, useUpcomingSession } from '@/hooks/useUpcomingSession';
import { colors, spacing } from '@/theme';

import CoachVideoCard from './components/CoachVideoCard';
import HeroCard from './components/HeroCard';
import HomeHeader from './components/HomeHeader';
import QuickActionsRow from './components/QuickActionsRow';
import StatTilesRow from './components/StatTilesRow';
import UpcomingSessionCard from './components/UpcomingSessionCard';
import { styles } from './styles';

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { kids } = useFamily();
  const kid = kids[0];
  const { session: upcoming } = useUpcomingSession(kid?.id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        user
          ? qc.invalidateQueries({ queryKey: ['family', user.id] })
          : Promise.resolve(),
        kid
          ? qc.invalidateQueries({ queryKey: upcomingSessionKey(kid.id) })
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, user, kid]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HomeHeader locationName="Dallas N." />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + spacing['4xl'] },
        ]}
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
            <View style={styles.section}>
              {/* Tap is intentionally a no-op for v0.3 — navigation to a */}
              {/* booking detail / list screen lands in v0.4. */}
              <UpcomingSessionCard
                date={upcoming?.scheduledStart}
                durationMinutes={upcoming?.durationMinutes}
                coachName={upcoming?.coachName}
                location={upcoming?.locationName}
              />
            </View>
          </>
        ) : null}
        <View style={styles.section}>
          <QuickActionsRow />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
