import { ReactNode } from 'react';
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
  label: string;
  value: string | number;
  icon?: ReactNode;
  accent?: 'gold' | 'default';
};

export default function StatTile({ label, value, icon, accent = 'default' }: Props) {
  return (
    <View style={styles.tile}>
      <View style={styles.labelRow}>
        {icon ? <View style={styles.icon}>{icon}</View> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text
        style={[styles.value, accent === 'gold' && styles.valueGold]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },
  value: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    letterSpacing: -tracking.tight,
  },
  valueGold: {
    color: colors.gold,
  },
});
