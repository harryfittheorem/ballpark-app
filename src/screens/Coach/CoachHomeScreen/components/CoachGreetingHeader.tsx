import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';

import type { CoachGreetingHeaderProps } from '../types';

export default function CoachGreetingHeader({ firstName }: CoachGreetingHeaderProps) {
  const name = firstName?.trim() || 'Coach';
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>WELCOME BACK</Text>
      <Text style={styles.greeting} numberOfLines={1}>
        Hey, {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  greeting: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
  },
});
