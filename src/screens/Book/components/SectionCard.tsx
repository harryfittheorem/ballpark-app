import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  locked?: boolean;
  lockedHint?: string;
  children: ReactNode;
};

export default function SectionCard({
  title,
  subtitle,
  locked = false,
  lockedHint,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View
        style={[styles.body, locked && styles.bodyLocked]}
        pointerEvents={locked ? 'none' : 'auto'}
      >
        {children}
      </View>
      {locked && lockedHint ? <Text style={styles.lockedHint}>{lockedHint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius['3xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  body: {
    marginTop: spacing.lg,
  },
  bodyLocked: {
    opacity: 0.4,
  },
  lockedHint: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
