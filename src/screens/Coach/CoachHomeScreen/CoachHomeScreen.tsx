/**
 * Coach landing screen — the home base Coach Mike sees when he opens the app.
 *
 * Greets by first name (from `public.coaches`) and surfaces the two Phase C
 * actions: record a new video, or look at videos already sent. The bookings
 * stat row is a placeholder until v0.4 wires it to a real Supabase query.
 */

import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Video } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { coachKey, useCoach } from '@/hooks/useCoach';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/error';

import BookingsStatRow from './components/BookingsStatRow';
import CoachActionCard from './components/CoachActionCard';
import CoachGreetingHeader from './components/CoachGreetingHeader';
import { styles } from './styles';

type Nav = CoachInboxStackScreenProps<'InboxHome'>['navigation'];

// Placeholder count — wired to a real Supabase query in a later v0.4 step.
const PLACEHOLDER_UPCOMING_BOOKINGS = 3;

export default function CoachHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { firstName } = useCoach();
  const qc = useQueryClient();

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <CoachGreetingHeader firstName={firstName} />
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
        <View style={styles.section}>
          <BookingsStatRow upcomingCount={PLACEHOLDER_UPCOMING_BOOKINGS} />
        </View>
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
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
