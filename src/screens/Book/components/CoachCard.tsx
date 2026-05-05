import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  specialty: string | null;
  bio: string | null;
  selected?: boolean;
  readOnly?: boolean;
  onPress?: () => void;
};

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0).toUpperCase();
  const b = last.trim().charAt(0).toUpperCase();
  return `${a}${b}` || '?';
}

export default function CoachCard({
  firstName,
  lastName,
  avatarUrl,
  specialty,
  bio,
  selected = false,
  readOnly = false,
  onPress,
}: Props) {
  const fullName = `${firstName} ${lastName}`.trim();
  const subtitle = specialty ?? bio ?? null;

  const content = (
    <>
      {readOnly ? (
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>Auto-selected</Text>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{initials(firstName, lastName)}</Text>
          )}
        </View>
        <View style={styles.body}>
          <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
            {fullName}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.subtitle, selected && styles.subtitleSelected]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );

  if (readOnly || !onPress) {
    return (
      <View
        style={[styles.card, styles.cardReadOnly]}
        accessibilityRole="text"
        accessibilityLabel={`${fullName}, automatically selected`}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={fullName}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && !selected && styles.cardPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const AVATAR_SIZE = 48;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
    gap: spacing.base,
  },
  cardSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
  },
  cardPressed: {
    borderColor: colors.borderGold,
  },
  cardReadOnly: {
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.06)',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  badge: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.darkest,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  avatarInitials: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
    letterSpacing: tracking.wide,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  nameSelected: {
    color: colors.gold,
  },
  subtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
  },
  subtitleSelected: {
    color: colors.textOnDark,
  },
});
