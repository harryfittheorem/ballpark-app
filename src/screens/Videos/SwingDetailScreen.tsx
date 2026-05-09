/**
 * SwingDetailScreen — task #119.
 *
 * Layout:
 *   - 16:9 placeholder for the swing clip (per-swing Mux clips ship in
 *     a future task — until then we render a dark "no clip yet" panel).
 *   - PR-aware metric grid (exit velo / launch / distance / pitch speed).
 *   - Action row: Heart toggle (optimistic via useToggleFavorite),
 *     Share (Alert stub — Share Card 9:16 generator is a separate task),
 *     Send to coach (Alert stub — composer ships in another task).
 *   - PR badges card when this swing IS a PR.
 *
 * Share + Send are intentionally stubbed (Alert.alert) so the layout +
 * navigation contract are stable when the real flows graduate. The
 * action row is wired to real handlers only for "Favorite" today.
 */

import { useRoute } from '@react-navigation/native';
import { Award, Heart, Send, Share2, Star } from 'lucide-react-native';
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
import { useFamily } from '@/hooks/useFamily';
import {
  useFavoriteSwingIds,
  usePersonalBestsForKid,
  useSwing,
  useToggleFavorite,
} from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Route = VideosStackScreenProps<'SwingDetail'>['route'];

const METRIC_LABELS: Record<string, string> = {
  exit_velocity_mph: 'Exit velo',
  launch_angle_deg: 'Launch',
  distance_ft: 'Distance',
  pitch_speed_mph: 'Pitch mph',
};

const METRIC_UNITS: Record<string, string> = {
  exit_velocity_mph: 'MPH',
  launch_angle_deg: '°',
  distance_ft: 'FT',
  pitch_speed_mph: 'MPH',
};

function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null) return '—';
  return Number(v).toFixed(digits);
}

export default function SwingDetailScreen() {
  const route = useRoute<Route>();
  const { swingId } = route.params;
  const { kids } = useFamily();
  const kid = kids[0] ?? null;

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
  // A PR row points at this swing exactly when this swing IS that metric's
  // current best. We render gold pill badges per matching metric.
  const prMatches = (prs ?? []).filter((p) => p.swing_id === swing.id);

  const handleFavorite = () => {
    toggleFav.mutate(swing.id, {
      onError: (err) => Alert.alert('Could not save favorite', errorMessage(err)),
    });
  };

  const handleShare = () => {
    Alert.alert(
      'Share card coming soon',
      'A 9:16 share image with metrics + PR badges ships in the next release.',
    );
  };

  const handleSend = () => {
    Alert.alert(
      'Send to coach coming soon',
      'A short note + this swing card will be sendable to your coach in the next release.',
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Header swing={swing} />
        <PlaceholderPlayer />
        <MetricGrid swing={swing} prs={prMatches.map((p) => p.metric)} />
        <ActionRow
          favorited={favorited}
          favSaving={toggleFav.isPending}
          onFavorite={handleFavorite}
          onShare={handleShare}
          onSend={handleSend}
        />
        {prMatches.length > 0 ? <PRsCard prMetrics={prMatches.map((p) => p.metric)} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ swing }: { swing: Swing }) {
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
    <View style={styles.headerWrap}>
      <Text style={styles.headerTitle}>{label.toUpperCase()}</Text>
      {swing.result ? <Text style={styles.headerSubtitle}>{swing.result.toUpperCase()}</Text> : null}
    </View>
  );
}

function PlaceholderPlayer() {
  // No per-swing Mux clip yet (HitTrax is metric-only). The 16:9 placeholder
  // pins layout so the screen is forward-compatible with a real <Video />
  // when the per-swing clip pipeline ships.
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
    { key: 'launch_angle_deg', metric: 'launch_angle_deg' },
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
              {fmt(v, key === 'launch_angle_deg' || key === 'distance_ft' ? 0 : 1)}
            </Text>
            <Text style={styles.metricUnit}>{METRIC_UNITS[metric]}</Text>
            <Text style={styles.metricLabel}>{METRIC_LABELS[metric].toUpperCase()}</Text>
          </View>
        );
      })}
    </View>
  );
}

function ActionRow({
  favorited,
  favSaving,
  onFavorite,
  onShare,
  onSend,
}: {
  favorited: boolean;
  favSaving: boolean;
  onFavorite: () => void;
  onShare: () => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.actionRow}>
      <ActionButton
        icon={
          <Heart
            size={18}
            color={favorited ? colors.gold : colors.textLight}
            fill={favorited ? colors.gold : 'transparent'}
          />
        }
        label={favorited ? 'Saved' : 'Favorite'}
        onPress={onFavorite}
        disabled={favSaving}
      />
      <ActionButton
        icon={<Share2 size={18} color={colors.textLight} />}
        label="Share"
        onPress={onShare}
      />
      <ActionButton
        icon={<Send size={18} color={colors.textLight} />}
        label="Send"
        onPress={onSend}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        pressed && styles.actionBtnPressed,
        disabled && styles.actionBtnDisabled,
      ]}
    >
      {icon}
      <Text style={styles.actionLabel}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

function PRsCard({ prMetrics }: { prMetrics: string[] }) {
  return (
    <View style={styles.prsCard}>
      <View style={styles.prsHeader}>
        <Award size={18} color={colors.gold} />
        <Text style={styles.prsTitle}>PERSONAL BEST</Text>
      </View>
      <Text style={styles.prsBody}>
        This swing set a new PR in {prMetrics.map((m) => METRIC_LABELS[m] ?? m).join(', ')}.
        +15 points credited automatically.
      </Text>
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
  headerWrap: { marginBottom: spacing['2xl'] },
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
    gap: spacing.base,
    marginBottom: spacing['2xl'],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing['2xl'],
  },
  actionBtnPressed: { opacity: 0.7 },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  prsCard: {
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.gold,
    padding: spacing['2xl'],
  },
  prsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  prsTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
  },
  prsBody: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.base,
    lineHeight: 20,
  },
});
