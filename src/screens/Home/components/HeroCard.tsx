import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  pointsBalance: number;
  nextRewardName: string | null;
  nextRewardCost: number | null;
  onPress?: () => void;
};

export default function HeroCard({
  pointsBalance,
  nextRewardName,
  nextRewardCost,
  onPress,
}: Props) {
  const cost = nextRewardCost ?? 0;
  const pointsAway = cost > 0 ? Math.max(cost - pointsBalance, 0) : 0;
  const progressPct =
    cost > 0 ? Math.min(Math.max(pointsBalance / cost, 0), 1) : 0;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.shadow}>
      <LinearGradient
        colors={[colors.gold, colors.goldBright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.decorCircle} pointerEvents="none" />
        <View style={styles.innerBorder} pointerEvents="none" />

        <View style={styles.content}>
          <Text style={styles.eyebrow}>YOUR POINTS</Text>
          <View style={styles.row}>
            <Text style={styles.pointsValue}>{pointsBalance}</Text>
            {nextRewardCost != null ? (
              <Text style={styles.pointsTotal}> / {nextRewardCost}</Text>
            ) : null}
          </View>
          {nextRewardName ? (
            <Text style={styles.nextLabel} numberOfLines={1}>
              NEXT REWARD: {nextRewardName.toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.nextLabel}>KEEP EARNING</Text>
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct * 100}%` }]} />
          </View>
          {nextRewardCost != null ? (
            <Text style={styles.awayLabel}>
              {pointsAway === 0 ? 'READY TO REDEEM' : `${pointsAway} PTS AWAY`}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const DECOR_SIZE = spacing['7xl'] * 3;

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.darkest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: radius['5xl'],
  },
  card: {
    borderRadius: radius['5xl'],
    padding: spacing['3xl'],
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    top: -spacing['5xl'],
    right: -spacing['5xl'],
    width: DECOR_SIZE,
    height: DECOR_SIZE,
    borderRadius: DECOR_SIZE / 2,
    backgroundColor: colors.dark,
    opacity: 0.08,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius['5xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  content: { position: 'relative', zIndex: 1 },
  eyebrow: {
    fontFamily: fontFamilies.interExtraBold,
    fontSize: fontSizes.sm,
    color: colors.dark,
    opacity: 0.7,
    letterSpacing: tracking.wider,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.base },
  pointsValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['6xl'],
    color: colors.dark,
    letterSpacing: -tracking.wide,
    lineHeight: fontSizes['6xl'],
  },
  pointsTotal: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.dark,
    opacity: 0.55,
    paddingBottom: 6,
  },
  nextLabel: {
    fontFamily: fontFamilies.interExtraBold,
    fontSize: fontSizes.sm,
    color: colors.dark,
    opacity: 0.75,
    letterSpacing: tracking.wide,
    marginTop: spacing.lg,
  },
  progressTrack: {
    marginTop: spacing.base,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.dark,
    borderRadius: radius.full,
  },
  awayLabel: {
    fontFamily: fontFamilies.interExtraBold,
    fontSize: fontSizes.xs,
    color: colors.dark,
    opacity: 0.7,
    letterSpacing: tracking.wider,
    marginTop: spacing.base,
  },
});
