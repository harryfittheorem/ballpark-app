import { StyleSheet, Text, View } from 'react-native';

import KidSwitcherPill from '@/components/ui/KidSwitcherPill';
import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';

export default function BookHeader() {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>RESERVE YOUR SPOT</Text>
          <Text style={styles.title}>BOOK</Text>
        </View>
        <KidSwitcherPill />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
