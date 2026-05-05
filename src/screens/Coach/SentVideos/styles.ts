/**
 * Styles for the coach Sent Videos screen + SentMessageRow.
 *
 * Visual weight intentionally mirrors `CoachVideoCard` (the parent-side
 * "today's video" card) so the design language is consistent across both
 * sides of the thread.
 */

import { StyleSheet } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },

  // Empty state.
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.base,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Error state.
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['3xl'],
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

  // List.
  listContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['6xl'],
  },

  // SentMessageRow.
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius['3xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing.lg,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumbWrap: {
    width: 72,
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbProcessingText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.gold,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15, 14, 14, 0.75)',
  },
  durationText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
  },

  rowBody: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  recipientName: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  familyLine: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.base,
  },
  sentTime: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textMuted,
  },

  badge: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  badgeViewed: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  badgeSent: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  badgeText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },
  badgeTextViewed: {
    color: colors.dark,
  },
  badgeTextSent: {
    color: colors.textMuted,
  },
});
