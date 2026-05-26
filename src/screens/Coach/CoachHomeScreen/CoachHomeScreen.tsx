/**
 * Coach / admin landing screen — home base for staff when they open the app.
 *
 * Greets by first name and organises content into two pill sub-tabs:
 *   • Home     — action cards (send video, review drills, etc.)
 *   • Sessions — today's check-in board with real-time Supabase updates
 *
 * Coaches see only their own bookings in Sessions. Admins (app_role = 'admin')
 * see the full tenant board.
 */

import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Dumbbell, Send, Video } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { coachKey, useCoach } from '@/hooks/useCoach';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

import BookingsStatRow from './components/BookingsStatRow';
import CoachActionCard from './components/CoachActionCard';
import CoachGreetingHeader from './components/CoachGreetingHeader';
import SessionsBody from './subtabs/SessionsBody';

type Nav = CoachInboxStackScreenProps<'InboxHome'>['navigation'];
type TabKey = 'home' | 'sessions';

// Placeholder count — wired to a real Supabase query in a later step.
const PLACEHOLDER_UPCOMING_BOOKINGS = 3;

export default function CoachHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user, appRole } = useAuth();
  const { firstName } = useCoach();
  const qc = useQueryClient();

  const [tab, setTab] = useState<TabKey>('home');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user) {
        await qc.invalidateQueries({ queryKey: coachKey(user.id) });
      }
    } finally {
      setRefreshing(false);
    }
  }, [qc, user]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to sign in again to use Ballpark.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert('Sign-out failed', errorMessage(err));
          }
        },
      },
    ]);
  }, []);

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: 'home', label: 'Home' },
      { key: 'sessions', label: 'Sessions' },
    ],
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CoachGreetingHeader firstName={firstName} />

      {/* Sub-tab pill bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.pill, active && styles.pillActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={t.label}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab body */}
      {tab === 'sessions' ? (
        <SessionsBody />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
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
          {appRole === 'coach' && (
            <View style={styles.section}>
              <BookingsStatRow upcomingCount={PLACEHOLDER_UPCOMING_BOOKINGS} />
            </View>
          )}
          <View style={[styles.section, styles.cards]}>
            <CoachActionCard
              title="New Video"
              subtitle="Record a quick message and send it to a family."
              icon={Video}
              onPress={() => navigation.navigate('RecordVideo')}
            />
            <CoachActionCard
              title="My Videos"
              subtitle="See videos you've already sent."
              icon={Send}
              onPress={() => navigation.navigate('SentVideos')}
            />
            {appRole === 'coach' && (
              <>
                <CoachActionCard
                  title="Assign Drill"
                  subtitle="Send a kid a drill to practice this week."
                  icon={Dumbbell}
                  onPress={() => navigation.navigate('CreateAssignment')}
                />
                <CoachActionCard
                  title="Review Drills"
                  subtitle="Rate and respond to submitted drills."
                  icon={ClipboardCheck}
                  onPress={() => navigation.navigate('ReviewQueue')}
                />
              </>
            )}
          </View>
          <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['5xl'],
  },
  section: { marginBottom: spacing['2xl'] },
  cards: { gap: spacing['2xl'] },
  signOutBtn: {
    marginTop: spacing['4xl'],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  signOutText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  tabBarWrapper: { flexShrink: 0 },
  tabBar: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.base,
    gap: spacing.base,
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  pillTextActive: { color: colors.dark },
});
