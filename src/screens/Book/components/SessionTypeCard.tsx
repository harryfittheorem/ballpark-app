import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  name: string;
  durationMinutes: number;
  basePriceCents: number;
  selected: boolean;
  onPress: () => void;
};

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (rest === 0) return hours === 1 ? '1 hr' : `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Free';
  // USD only for v0.3 — no Intl needed.
  const dollars = cents / 100;
  // Whole-dollar prices render without trailing `.00` to match the rest of
  // the booking UI ("$45" not "$45.00"); fractional cents keep two decimals.
  return cents % 100 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export default function SessionTypeCard({
  name,
  durationMinutes,
  basePriceCents,
  selected,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${name}, ${formatDuration(durationMinutes)}, ${formatPrice(basePriceCents)}`}
    >
      <View style={styles.row}>
        <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[styles.price, selected && styles.priceSelected]}>
          {formatPrice(basePriceCents)}
        </Text>
      </View>
      <Text style={styles.duration}>{formatDuration(durationMinutes)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
  },
  cardPressed: {
    borderColor: colors.borderGold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing['2xl'],
  },
  name: {
    flex: 1,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  nameSelected: {
    color: colors.gold,
  },
  price: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
  },
  priceSelected: {
    color: colors.gold,
  },
  duration: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
