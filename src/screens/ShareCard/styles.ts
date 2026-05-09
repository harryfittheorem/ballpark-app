import { StyleSheet } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    paddingHorizontal: spacing['3xl'],
    textAlign: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wider,
  },
  scroll: {
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing['6xl'],
    alignItems: 'center',
  },
  previewWrap: { alignItems: 'center', marginVertical: spacing['3xl'] },
  previewCaption: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing['2xl'],
  },
  primaryGrid: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing['3xl'],
  },
  primaryTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.darker,
  },
  actions: { width: '100%', gap: spacing['2xl'] },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
    paddingVertical: spacing['3xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
  },
  actionRowPrimary: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  actionRowSecondary: {
    backgroundColor: 'transparent',
    borderColor: colors.borderGold,
  },
  actionRowPressed: { opacity: 0.85 },
});
