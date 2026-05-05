import { StyleSheet } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

export const POSTER_HEIGHT = 200;

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['7xl'],
  },

  // Summary card -------------------------------------------------------------
  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    marginBottom: spacing['3xl'],
  },
  poster: {
    width: '100%',
    height: POSTER_HEIGHT,
    backgroundColor: colors.darkest,
  },
  posterPlaceholder: {
    width: '100%',
    height: POSTER_HEIGHT,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  posterPlaceholderText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
  posterErrorText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },

  cardBody: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
    gap: spacing.lg,
  },
  fieldLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.xxs,
  },
  fieldValue: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  fieldValueMuted: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },

  // Note input ---------------------------------------------------------------
  noteLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  noteInput: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
    minHeight: 110,
    textAlignVertical: 'top',
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
    marginBottom: spacing['3xl'],
  },

  // Inline error -------------------------------------------------------------
  errorBanner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.xl,
    marginBottom: spacing['2xl'],
  },
  errorBannerText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.danger,
  },

  // Footer (Send / Back) -----------------------------------------------------
  footer: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.darkest,
    gap: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.xl,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  secondaryBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
});
