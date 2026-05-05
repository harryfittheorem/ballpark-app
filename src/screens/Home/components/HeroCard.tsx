import { LinearGradient } from 'expo-linear-gradient';
import { Flame } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  kidName: string;
  ageGroup: string;
  jerseyNumber?: number | null;
  pointsBalance: number;
  currentStreakDays: number;
};

export default function HeroCard({
  kidName,
  ageGroup,
  jerseyNumber,
  pointsBalance,
  currentStreakDays,
}: Props) {
  const subtitle =
    jerseyNumber != null ? `${ageGroup} · #${jerseyNumber}` : ageGroup;

  return (
    <View style={styles.shadow}>
      <LinearGradient
        colors={[colors.gold, colors.goldBright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.innerBorder} pointerEvents="none" />

        <Text style={styles.name} numberOfLines={1}>
          {kidName.toUpperCase()}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.pointsBlock}>
          <Text style={styles.pointsValue}>{pointsBalance}</Text>
          <Text style={styles.pointsLabel}>POINTS</Text>
        </View>

        <View style={styles.streakRow}>
          <Flame size={16} color={colors.dark} fill={colors.goldDeep} />
          <Text style={styles.streakText}>{currentStreakDays} DAY STREAK</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

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
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius['5xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.dark,
    letterSpacing: -tracking.tight,
  },
  subtitle: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.dark,
    opacity: 0.7,
    marginTop: spacing.xs,
  },
  pointsBlock: {
    marginTop: spacing['3xl'],
  },
  pointsValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['6xl'],
    color: colors.dark,
    letterSpacing: -tracking.wide,
    lineHeight: fontSizes['6xl'],
  },
  pointsLabel: {
    fontFamily: fontFamilies.interExtraBold,
    fontSize: fontSizes.sm,
    color: colors.dark,
    opacity: 0.7,
    letterSpacing: tracking.wider,
    marginTop: spacing.xs,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginTop: spacing['2xl'],
  },
  streakText: {
    fontFamily: fontFamilies.interExtraBold,
    fontSize: fontSizes.base,
    color: colors.dark,
    letterSpacing: tracking.wide,
  },
});
