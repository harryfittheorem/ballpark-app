import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

type Props = { label: string };

export default function SectionPlaceholder({ label }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 120,
    borderRadius: radius['5xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  text: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
  },
});
