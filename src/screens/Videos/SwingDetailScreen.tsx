/**
 * SwingDetailScreen — task #119.
 *
 * Layout:
 *   - 16:9 placeholder for the swing clip (per-swing Mux clips ship in
 *     a future task — until then we render a dark "no clip yet" panel).
 *   - PR-aware metric grid (exit velo / launch / distance / pitch speed).
 *   - SHARE + SEND TO COACH 50/50 action row (Alert.alert stubs — the
 *     9:16 share-card generator + coach-composer ship in a follow-up).
 *   - Favorite is a heart icon on the screen header (not in the action
 *     row, per spec — the row is reserved for share/send).
 *   - When this swing IS a PR: a coach-note quote card + a dedicated
 *     points-earned sparkles card.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Award,
  Heart,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Star,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Swing } from '@/api/swings';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import {
  useFavoriteSwingIds,
  usePersonalBestsForKid,
  useSwing,
  useToggleFavorite,
} from '@/hooks/useSwings';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Route = WorkStackScreenProps<'SwingDetail'>['route'];
type Nav = WorkStackScreenProps<'SwingDetail'>['navigation'];

const METRIC_LABELS: Record<string, string> = {
  exit_velocity_mph: 'Exit velo',
  distance_ft: 'Distance',
  pitch_speed_mph: 'Pitch mph',
};

const METRIC_UNITS: Record<string, string> = {
  exit_velocity_mph: 'MPH',
  distance_ft: 'FT',
  pitch_speed_mph: 'MPH',
};

const PR_POINTS = 15;

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—';
  return Number(v).toFixed(digits);
}

export default function SwingDetailScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { swingId } = route.params;
  const { kid } = useSelectedKid();
  

  const { data: swing, isPending, isError, error } = useSwing(swingId);
  const { data: favorites } = useFavoriteSwingIds();
  const { data: prs } = usePersonalBestsForKid(kid?.id);
  const toggleFav = useToggleFavorite();

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }
  if (isError || !swing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {isError ? errorMessage(error) : 'Swing not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const favorited = favorites?.has(swing.id) ?? false;
  const prMatches = (prs ?? []).filter(
    (p) => p.swing_id === swing.id && p.metric !== 'launch_angle_deg',
  );

  const handleFavorite = () => {
    toggleFav.mutate(swing.id, {
      onError: (err) => Alert.alert('Could not save favorite', errorMessage(err)),
    });
  };

  const handleShare = () => {
    navigation.navigate('ShareCard', { swingId: swing.id });
  };

  const handleSend = () => {
    navigation.navigate('SendVideoToCoach', undefined);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header
          swing={swing}
          favorited={favorited}
          favSaving={toggleFav.isPending}
          onFavorite={handleFavorite}
        />
        <PlaceholderPlayer />
        <MetricGrid swing={swing} prs={prMatches.map((p) => p.metric)} />
        <ActionRow onShare={handleShare} onSend={handleSend} />
        {prMatches.length > 0 ? (
          <>
            <PRPointsCard count={prMatches.length} />
            <CoachNoteCard prMetrics={prMatches.map((p) => p.metric)} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  swing,
  favorited,
  favSaving,
  onFavorite,
}: {
  swing: Swing;
  favorited: boolean;
  favSaving: boolean;
  onFavorite: () => void;
}) {
  const d = new Date(swing.occurred_at);
  const label = Number.isNaN(d.getTime())
    ? 'Swing'
    : d.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{label.toUpperCase()}</Text>
        {swing.result ? (
          <Text style={styles.headerSubtitle}>{swing.result.toUpperCase()}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={onFavorite}
        disabled={favSaving}
        accessibilityRole="button"
        accessibilityLabel={favorited ? 'Remove from favorites' : 'Add to favorites'}
        hitSlop={12}
        style={({ pressed }) => [styles.favBtn, pressed && styles.favBtnPressed]}
      >
        <Heart
          size={22}
          color={favorited ? colors.gold : colors.textLight}
          fill={favorited ? colors.gold : 'transparent'}
        />
      </Pressable>
    </View>
  );
}

function PlaceholderPlayer() {
  return (
    <View style={styles.player}>
      <Text style={styles.playerLabel}>SWING CLIP COMING SOON</Text>
      <Text style={styles.playerHint}>
        Replays land here once your facility wires per-swing video capture.
      </Text>
    </View>
  );
}

function MetricGrid({ swing, prs }: { swing: Swing; prs: string[] }) {
  const items: { key: keyof Swing & string; metric: string }[] = [
    { key: 'exit_velocity_mph', metric: 'exit_velocity_mph' },
    { key: 'distance_ft', metric: 'distance_ft' },
    { key: 'pitch_speed_mph', metric: 'pitch_speed_mph' },
  ];
  return (
    <View style={styles.grid}>
      {items.map(({ key, metric }) => {
        const isPr = prs.includes(metric);
        const v = swing[key] as number | null;
        return (
          <View key={key} style={[styles.metricCell, isPr && styles.metricCellPr]}>
            {isPr ? (
              <View style={styles.prRibbon}>
                <Star size={10} color={colors.dark} fill={colors.dark} />
                <Text style={styles.prRibbonText}>PR</Text>
              </View>
            ) : null}
            <Text style={[styles.metricValue, isPr && styles.metricValuePr]}>
              {fmt(v, key === 'distance_ft' ? 0 : 1)}
            </Text>
            <Text style={styles.metricUnit}>{METRIC_UNITS[metric]}</Text>
            <Text style={styles.metricLabel}>{METRIC_LABELS[metric].toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ActionRow({ onShare, onSend }: { onShare: () => void; onSend: () => void }) {
  return (
    <View style={styles.actionRow}>
      <ActionButton
        icon={<Share2 size={18} color={colors.gold} />}
        label="Share"
        onPress={onShare}
      />
      <ActionButton
        icon={<Send size={18} color={colors.dark} />}
        label="Send to coach"
        onPress={onSend}
        primary
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        primary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
        pressed && styles.actionBtnPressed,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.actionLabel,
          primary ? styles.actionLabelPrimary : styles.actionLabelSecondary,
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

function PRPointsCard({ count }: { count: number }) {
  return (
    <View style={styles.prPointsCard}>
      <Sparkles size={26} color={colors.gold} />
      <View style={{ flex: 1 }}>
        <Text style={styles.prPointsTitle}>+{count * PR_POINTS} POINTS</Text>
        <Text style={styles.prPointsBody}>
          {count === 1
            ? 'New personal best — points credited to your account.'
            : `${count} new personal bests — points credited to your account.`}
        </Text>
      </View>
    </View>
  );
}

function CoachNoteCard({ prMetrics }: { prMetrics: string[] }) {
  const list = prMetrics.map((m) => METRIC_LABELS[m] ?? m).join(', ');
  return (
    <View style={styles.coachCard}>
      <View style={styles.coachHeader}>
        <Award size={16} color={colors.gold} />
        <Text style={styles.coachTitle}>PERSONAL BEST</Text>
      </View>
      <View style={styles.quoteRow}>
        <MessageCircle size={16} color={colors.gold} />
        <Text style={styles.quoteText}>
          &ldquo;Big swing — that&rsquo;s a new PR in {list}. Keep that swing path going.&rdquo;
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  content: { padding: spacing['3xl'], paddingBottom: spacing['6xl'] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing['3xl'],
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    gap: spacing.lg,
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    letterSpacing: tracking.wide,
  },
  headerSubtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    marginTop: spacing.xxs,
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  favBtnPressed: { opacity: 0.7 },
  player: {
    aspectRatio: 16 / 9,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing['3xl'],
  },
  playerLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
  },
  playerHint: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.base,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  metricCell: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
    minHeight: 96,
  },
  metricCellPr: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
  },
  prRibbon: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  prRibbonText: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
  metricValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  metricValuePr: { color: colors.gold },
  metricUnit: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
    marginTop: spacing.xxs,
  },
  metricLabel: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
    marginTop: spacing.base,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    borderWidth: 1,
  },
  actionBtnPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  actionBtnSecondary: { backgroundColor: colors.darker, borderColor: colors.border },
  actionBtnPressed: { opacity: 0.7 },
  actionLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wide,
  },
  actionLabelPrimary: { color: colors.dark },
  actionLabelSecondary: { color: colors.gold },
  prPointsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: 'rgba(241, 229, 173, 0.12)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  prPointsTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    letterSpacing: tracking.wide,
  },
  prPointsBody: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.xxs,
    lineHeight: 18,
  },
  coachCard: {
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
  },
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  coachTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
  },
  quoteRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.lg,
    paddingLeft: spacing.base,
  },
  quoteText: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    fontStyle: 'italic',
    lineHeight: 20,
  },
});
