/**
 * SessionDetailScreen — task #119.
 *
 * Header = StatsBar (swing count / top velo / avg velo). Body = 4-column
 * grid of every swing in the session, tappable into Swing Detail.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { ZapOff } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useFavoriteSwingIds,
  useSession,
  useSwingsForSession,
} from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

import EmptyState from './components/EmptyState';
import StatsBar from './components/StatsBar';
import SwingThumbnail from './components/SwingThumbnail';

type Route = VideosStackScreenProps<'SessionDetail'>['route'];
type Nav = VideosStackScreenProps<'SessionDetail'>['navigation'];

export default function SessionDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { sessionId } = route.params;

  const { data: session, isPending: sessionPending, isError, error } = useSession(sessionId);
  const { data: swings, isPending: swingsPending } = useSwingsForSession(sessionId);
  const { data: favorites } = useFavoriteSwingIds();

  if (sessionPending || swingsPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{isError ? errorMessage(error) : 'Session not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const date = new Date(session.started_at);
  const dateLabel = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const favSet = favorites ?? new Set<string>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerWrap}>
        <Text style={styles.title}>{dateLabel.toUpperCase()}</Text>
      </View>
      <View style={styles.statsWrap}>
        <StatsBar
          stats={[
            { label: 'Swings', value: String(session.swing_count ?? swings?.length ?? 0) },
            {
              label: 'Top mph',
              value:
                session.best_exit_velocity_mph != null
                  ? Number(session.best_exit_velocity_mph).toFixed(1)
                  : '—',
            },
            {
              label: 'Avg mph',
              value:
                session.avg_exit_velocity_mph != null
                  ? Number(session.avg_exit_velocity_mph).toFixed(1)
                  : '—',
            },
          ]}
        />
      </View>

      {(swings ?? []).length === 0 ? (
        <EmptyState
          icon={<ZapOff size={26} color={colors.gold} />}
          title="No swings in this session"
          body="HitTrax may still be syncing — pull to refresh in a moment."
        />
      ) : (
        <FlatList
          data={swings ?? []}
          keyExtractor={(s) => s.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <SwingThumbnail
                swing={item}
                favorited={favSet.has(item.id)}
                onPress={() => navigation.navigate('SwingDetail', { swingId: item.id })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  headerWrap: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
  },
  statsWrap: { paddingHorizontal: spacing['3xl'], marginBottom: spacing['2xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing['3xl'],
    textAlign: 'center',
  },
  gridContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  gridRow: { gap: spacing.base, marginBottom: spacing.base },
  gridCell: { flex: 1 },
});
