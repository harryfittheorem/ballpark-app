import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export type SubTabKey = 'rewards' | 'store' | 'ranks' | 'earn';

const TABS: { key: SubTabKey; label: string }[] = [
  { key: 'rewards', label: 'Rewards' },
  { key: 'store', label: 'Store' },
  { key: 'ranks', label: 'Ranks' },
  { key: 'earn', label: 'Earn' },
];

export default function SubTabBar({
  value,
  onChange,
}: {
  value: SubTabKey;
  onChange: (k: SubTabKey) => void;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = t.key === value;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.darker,
    borderRadius: radius.full,
    padding: spacing.xs,
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  pillActive: {
    backgroundColor: colors.gold,
  },
  pillText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  pillTextActive: {
    color: colors.dark,
  },
});
