import { StyleSheet } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },

  // Loading / error / empty states.
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['3xl'],
  },
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['5xl'],
  },
  retryBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },

  // Section list.
  listContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['7xl'] + 64, // leave room for sticky footer.
  },
  sectionHeader: {
    backgroundColor: colors.darkest,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
  },
  sectionHeaderText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },

  // KidRow.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.lg,
    gap: spacing['2xl'],
  },
  rowSelected: {
    borderColor: colors.gold,
    backgroundColor: colors.dark,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
  },
  avatarInitials: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
  rowTextWrap: { flex: 1 },
  rowName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.xxs,
  },
  rowMeta: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },

  // Sticky footer.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.darkest,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
  },
  continueBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.xl,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
