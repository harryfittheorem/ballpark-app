import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

type Props = { icon: ReactNode; title: string; body: string };

export default function EmptyState({ icon, title, body }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing['6xl'],
    paddingHorizontal: spacing['3xl'],
    marginHorizontal: spacing['3xl'],
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    textAlign: 'center',
  },
  body: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing.base,
  },
});
