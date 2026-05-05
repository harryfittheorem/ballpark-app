/**
 * Coach Sent Videos screen — v0.4 Step 4.11.
 *
 * Chronological list (newest first) of every coach_messages row Coach Mike
 * has sent. Each row shows: Mux poster thumb, recipient kid name, family,
 * relative sent time, and a Viewed/Sent badge.
 *
 * Data flow:
 *   `useSentCoachMessages()` (TanStack Query, key
 *   `['coachMessages', 'sent', userId]`) — refetches on screen focus and on
 *   pull-to-refresh. The same key is invalidated by `useSendCoachMessage()`
 *   so a freshly-sent message appears at the top without a manual refresh.
 *
 * Out of scope (per task): playback / detail screen, resend / delete,
 * realtime updates.
 */

import { Send } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSentCoachMessages } from '@/hooks/useSentCoachMessages';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/error';

import SentMessageRow from './components/SentMessageRow';
import { styles } from './styles';

export default function SentVideosScreen() {
  const { data, isPending, isError, error, refetch, isRefetching } =
    useSentCoachMessages();
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  }, [refetch]);

  const refreshControl = (
    <RefreshControl
      refreshing={manualRefreshing || isRefetching}
      onRefresh={onRefresh}
      tintColor={colors.gold}
      colors={[colors.gold]}
    />
  );

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn&apos;t load videos</Text>
          <Text style={styles.errorBody}>{errorMessage(error)}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.retryBtn}
            onPress={() => void refetch()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const messages = data ?? [];

  if (messages.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <FlatList
          data={[]}
          keyExtractor={() => 'noop'}
          renderItem={() => null}
          refreshControl={refreshControl}
          contentContainerStyle={styles.centered}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={styles.emptyIconWrap}>
                <Send size={32} color={colors.gold} />
              </View>
              <Text style={styles.emptyTitle}>No videos yet</Text>
              <Text style={styles.emptyBody}>
                You haven&apos;t sent any videos yet — tap New Video to send
                your first.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SentMessageRow message={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={refreshControl}
      />
    </SafeAreaView>
  );
}
