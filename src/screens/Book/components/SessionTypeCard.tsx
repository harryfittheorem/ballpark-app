import { Hash, User, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type TypeCategory = 'private' | 'group' | 'cage' | string;

type Props = {
  name: string;
  durationMinutes: number;
  basePriceCents: number;
  selected: boolean;
  typeCategory?: TypeCategory;
  /**
   * When provided, replaces the dollar-price display.
   * Pass "1 credit", "Included", etc. for members.
   * Non-members receive null/undefined and see the dollar amount.
   */
  priceOverride?: string | null;
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
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function CategoryIcon({
  typeCategory,
  selected,
}: {
  typeCategory: TypeCategory;
  selected: boolean;
}) {
  const color = selected ? colors.gold : colors.textLight;
  const size = 28;
  if (typeCategory === 'group') return <Users size={size} color={color} />;
  if (typeCategory === 'cage') return <Hash size={size} color={color} />;
  return <User size={size} color={color} />;
}

export default function SessionTypeCard({
  name,
  durationMinutes,
  basePriceCents,
  selected,
  typeCategory = 'private',
  priceOverride,
  onPress,
}: Props) {
  // Free sessions always show "Free" regardless of membership status
  const isFree = basePriceCents === 0;
  const displayPrice = isFree
    ? 'Free'
    : (priceOverride ?? formatPrice(basePriceCents));

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
      accessibilityLabel={`${name}, ${formatDuration(durationMinutes)}, ${displayPrice}`}
    >
      <View style={styles.iconWrap}>
        <CategoryIcon typeCategory={typeCategory} selected={selected} />
      </View>
      <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={[styles.duration, selected && styles.durationSelected]}>
        {formatDuration(durationMinutes)}
      </Text>
      <Text style={[styles.price, selected && styles.priceSelected]}>
        {displayPrice}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing['2xl'],
    gap: spacing.xs,
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
  },
  cardPressed: {
    borderColor: colors.borderGold,
  },
  iconWrap: {
    marginBottom: spacing.base,
  },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    color: colors.textOnDark,
    letterSpacing: tracking.wide,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  nameSelected: {
    color: colors.gold,
  },
  duration: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textAlign: 'center',
  },
  durationSelected: {
    color: colors.textOnDark,
  },
  price: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
    textAlign: 'center',
  },
  priceSelected: {
    color: colors.gold,
  },
});
