import { Coins } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function PointsBadge({
  points,
  variant = 'gold',
}: {
  points: number;
  variant?: 'gold' | 'muted';
}) {
  const tone = variant === 'gold' ? styles.gold : styles.muted;
  const text = variant === 'gold' ? styles.goldText : styles.mutedText;
  return (
    <View style={[styles.badge, tone]}>
      <Coins size={12} color={variant === 'gold' ? colors.dark : colors.gold} />
      <Text style={[styles.text, text]}>{points.toLocaleString()} PTS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  gold: {
    backgroundColor: colors.gold,
  },
  muted: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  text: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  goldText: {
    color: colors.dark,
  },
  mutedText: {
    color: colors.gold,
  },
});
