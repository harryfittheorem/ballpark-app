import { ChevronDown } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  kidFirstName: string;
  multipleKids?: boolean;
  onSwitchPress?: () => void;
};

export default function HomeHeader({ kidFirstName, multipleKids, onSwitchPress }: Props) {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        {multipleKids && onSwitchPress ? (
          <Pressable
            onPress={onSwitchPress}
            style={({ pressed }) => [styles.switcherPill, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel={`Currently viewing ${kidFirstName}. Tap to switch athlete.`}
          >
            <Text style={styles.switcherName} numberOfLines={1}>
              {kidFirstName.toUpperCase()}
            </Text>
            <ChevronDown size={16} color={colors.dark} strokeWidth={2.5} />
          </Pressable>
        ) : (
          <Text style={styles.greeting} numberOfLines={1}>
            {kidFirstName.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
    marginBottom: spacing.xs,
  },
  greeting: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    letterSpacing: -0.5,
  },
  switcherPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
  },
  switcherName: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
  },
});
