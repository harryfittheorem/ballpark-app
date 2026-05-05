import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';

export default function BookHeader() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>SCHEDULE</Text>
      <Text style={styles.title}>Book a Session</Text>
      <Text style={styles.subtitle}>Pick a session type, date, time, and coach.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    letterSpacing: -tracking.tight,
    marginTop: spacing.xs,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
});
