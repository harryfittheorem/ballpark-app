import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAssignments } from '@/hooks/useAssignments';
import { useAuth } from '@/hooks/useAuth';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useMembership } from '@/hooks/useMembership';
import { useProducts } from '@/hooks/useProducts';
import {
  latestCoachMessageKey,
  useLatestCoachMessage,
} from '@/hooks/useLatestCoachMessage';
import { personalBestsKeys, useLatestPersonalBest } from '@/hooks/useSwings';
import { upcomingSessionKey, useUpcomingSession } from '@/hooks/useUpcomingSession';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, spacing } from '@/theme';
import { formatRelativeTime } from '@/utils/time';

import KidSwitcherSheet from '@/components/ui/KidSwitcherSheet';
import CoachMessageToast from './components/CoachMessageToast';
import CoachVideoCard from './components/CoachVideoCard';
import EmptyHomeCard from './components/EmptyHomeCard';
import FailedPaymentCard from './components/FailedPaymentCard';
import HeroCard from './components/HeroCard';
import HomeAssignmentsCard from './components/HomeAssignmentsCard';
import HomeHeader from './components/HomeHeader';
import LatestPersonalBestCard from './components/LatestPersonalBestCard';
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
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const [paymentAlertDismissed, setPaymentAlertDismissed] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { kid, kids, loading: familyLoading, selectedKidId, setSelectedKid } = useSelectedKid();
  const { membership, refresh: refreshMembership } = useMembership();

  // Re-fetch membership on focus so the payment_failed_at banner clears
  // immediately after returning from PaymentMethodScreen.
  useFocusEffect(
    useCallback(() => {
      void refreshMembership();
    }, [refreshMembership]),
  );
  const showEmpty = !kid && !familyLoading;
  const { session: upcoming } = useUpcomingSession(kid?.id);
  const isFocused = useIsFocused();
  const { data: latestMessage, isPending: latestMessagePending } =
    useLatestCoachMessage(kid?.id, { enabled: isFocused });
  const { data: assignments } = useAssignments(kid?.id, ['pending']);
  const { data: latestPr } = useLatestPersonalBest(kid?.id);
  const { data: products } = useProducts();
  const { data: leaderboard } = useLeaderboard();

  const nextReward = useMemo(() => {
    if (!products || !kid) return null;
    const balance = kid.points_balance ?? 0;
    const affordable = products
      .filter((p) => p.points_cost != null && p.points_cost > balance)
      .sort((a, b) => (a.points_cost ?? 0) - (b.points_cost ?? 0));
    return affordable[0] ?? null;
  }, [products, kid]);

  const rank = useMemo(() => {
    if (!leaderboard || !kid) return null;
    const row = leaderboard.find((r) => r.kidId === kid.id);
    return row?.rank ?? null;
  }, [leaderboard, kid]);

  const exitVeloMph =
    latestPr && latestPr.metric === 'exit_velocity_mph'
      ? Number(latestPr.value)
      : null;

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
        kid
          ? qc.invalidateQueries({ queryKey: ['assignments', kid.id] })
          : Promise.resolve(),
        kid
          ? qc.invalidateQueries({ queryKey: personalBestsKeys.latestByKid(kid.id) })
          : Promise.resolve(),
        qc.invalidateQueries({ queryKey: ['products'] }),
        qc.invalidateQueries({ queryKey: ['leaderboard'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc, user, kid]);

  const renderCoachVideo = () => {
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
        unread={!latestMessage.viewedAt}
        onPress={() =>
          navigation.navigate('VideoPlayback', { messageId: latestMessage.id })
        }
      />
    );
  };

  const handleAddAthlete = () => {
    navigation.navigate('AddKid', { fromMe: false });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <HomeHeader
        kidFirstName={kid?.first_name ?? 'CHAMP'}
        multipleKids={kids.length > 1}
        onSwitchPress={() => setSwitcherVisible(true)}
      />
      <CoachMessageToast />
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
            {membership?.payment_failed_at && !paymentAlertDismissed ? (
              <View style={styles.section}>
                <FailedPaymentCard
                  onPress={() =>
                    navigation.navigate('Me', {
                      screen: 'PaymentMethod',
                    })
                  }
                  onDismiss={() => setPaymentAlertDismissed(true)}
                />
              </View>
            ) : null}
            <View style={styles.section}>
              <HeroCard
                pointsBalance={kid.points_balance}
                nextRewardName={nextReward?.name ?? null}
                nextRewardCost={nextReward?.points_cost ?? null}
                onPress={() => navigation.navigate('Earn', { screen: 'EarnHome' })}
              />
            </View>
            <View style={styles.section}>
              <StatTilesRow
                currentStreakDays={kid.current_streak_days}
                rank={rank}
                exitVeloMph={exitVeloMph}
              />
            </View>
            <View style={styles.section}>{renderCoachVideo()}</View>
            <View style={styles.section}>
              <UpcomingSessionCard
                date={upcoming?.scheduledStart}
                durationMinutes={upcoming?.durationMinutes}
                coachName={upcoming?.coachName}
                location={upcoming?.locationName}
              />
            </View>
            {assignments && assignments.some((a) => a.status === 'pending') ? (
              <View style={styles.section}>
                <HomeAssignmentsCard
                  assignments={assignments}
                  onPress={() =>
                    navigation.navigate('Work', {
                      screen: 'WorkHome',
                      params: { initialSubTab: 'assign' },
                    })
                  }
                />
              </View>
            ) : null}
            <View style={styles.section}>
              <LatestPersonalBestCard
                pr={latestPr ?? null}
                onPress={
                  latestPr?.swing_id
                    ? () =>
                        navigation.navigate('Work', {
                          screen: 'SwingDetail',
                          params: { swingId: latestPr.swing_id as string },
                        })
                    : () =>
                        navigation.navigate('Work', {
                          screen: 'WorkHome',
                          params: { initialSubTab: 'swings' },
                        })
                }
              />
            </View>
          </>
        ) : showEmpty ? (
          <View style={styles.section}>
            <EmptyHomeCard onAddKid={() => navigation.navigate('AddKid')} />
          </View>
        ) : (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}
      </ScrollView>

      <KidSwitcherSheet
        visible={switcherVisible}
        kids={kids}
        selectedKidId={selectedKidId}
        onSelect={setSelectedKid}
        onAddAthlete={handleAddAthlete}
        onClose={() => setSwitcherVisible(false)}
      />
    </SafeAreaView>
  );
}
