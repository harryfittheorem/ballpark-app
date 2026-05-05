import { StyleSheet } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.darkest,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['5xl'],
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  cards: {
    gap: spacing['2xl'],
  },
  signOutBtn: {
    marginTop: spacing['4xl'],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  signOutText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
