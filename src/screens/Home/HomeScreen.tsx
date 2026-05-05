import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import {
  latestCoachMessageKey,
  useLatestCoachMessage,
} from '@/hooks/useLatestCoachMessage';
import { upcomingSessionKey, useUpcomingSession } from '@/hooks/useUpcomingSession';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, spacing } from '@/theme';
import { formatRelativeTime } from '@/utils/time';

import CoachVideoCard from './components/CoachVideoCard';
import HeroCard from './components/HeroCard';
import HomeHeader from './components/HomeHeader';
import QuickActionsRow from './components/QuickActionsRow';
import StatTilesRow from './components/StatTilesRow';
import UpcomingSessionCard from './components/UpcomingSessionCard';
import { styles } from './styles';

const POSTER_WIDTH = 480;

function muxPosterUrl(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

type Nav = HomeStackScreenProps<'HomeMain'>['navigation'];

export default function HomeScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<Nav>();
  const [refreshing, setRefreshing] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { kids } = useFamily();
  const kid = kids[0];
  const { session: upcoming } = useUpcomingSession(kid?.id);
  const { data: latestMessage, isPending: latestMessagePending } =
    useLatestCoachMessage(kid?.id);

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
        kid
          ? qc.invalidateQueries({ queryKey: latestCoachMessageKey(kid.id) })
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, user, kid]);

  // Pick the right CoachVideoCard variant based on what the latest message
  // query returned. We render the card unconditionally (with an empty-state
  // variant) so the section keeps its slot in the layout even when there
  // are no messages yet — no jarring shift the moment the first one arrives.
  const renderCoachVideo = () => {
    // While the query is in flight, show the "processing" placeholder
    // (non-interactive, same chrome) so we don't briefly flash the empty
    // state to a parent who actually has videos.
    if (latestMessagePending) {
      return <CoachVideoCard variant="processing" />;
    }
    if (!latestMessage) {
      return <CoachVideoCard variant="empty" />;
    }
    const video = latestMessage.video;
    if (!video || video.status !== 'ready' || !video.muxPlaybackId) {
      return <CoachVideoCard variant="processing" />;
    }
    const coachName = latestMessage.coach
      ? `${latestMessage.coach.firstName} ${latestMessage.coach.lastName}`.trim()
      : 'Your coach';
    return (
      <CoachVideoCard
        variant="ready"
        coachName={coachName}
        thumbnail={muxPosterUrl(video.muxPlaybackId)}
        durationSeconds={video.durationSeconds ?? undefined}
        subtitle={formatRelativeTime(latestMessage.createdAt)}
        onPress={() =>
          navigation.navigate('VideoPlayback', { messageId: latestMessage.id })
        }
      />
    );
  };

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
            <View style={styles.section}>{renderCoachVideo()}</View>
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
