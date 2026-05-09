/**
 * SubTabBar for the Videos screen. Four tabs per spec:
 * SWINGS · HOMEWORK · MESSAGES · FAVORITES.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export type VideosSubTabKey = 'swings' | 'homework' | 'messages' | 'favorites';

const TABS: { key: VideosSubTabKey; label: string }[] = [
  { key: 'swings', label: 'Swings' },
  { key: 'homework', label: 'Homework' },
  { key: 'messages', label: 'Messages' },
  { key: 'favorites', label: 'Favorites' },
];

export default function SubTabBar({
  value,
  onChange,
}: {
  value: VideosSubTabKey;
  onChange: (k: VideosSubTabKey) => void;
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
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  pillActive: { backgroundColor: colors.gold },
  pillText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  pillTextActive: { color: colors.dark },
});
