/**
 * WorkScreen — task #135.
 *
 * The consolidated Work tab. Five in-screen sub-tabs:
 *   Swings   — HitTrax sessions / swings (was Videos → Swings)
 *   Assign   — drill assignments queue (the original v0.6 Work tab)
 *   Messages — coach video rail + per-coach inbox
 *   HW       — homework / drill submission view
 *   Drills   — self-serve training video library (was Train tab)
 *
 * Sub-tab routing is intentionally in-screen — the WorkStack only
 * registers push destinations (AssignmentDetail, SwingDetail, etc).
 */

import { useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import AssignBody from './subtabs/AssignBody';
import DrillsBody from './subtabs/DrillsBody';
import HwBody from './subtabs/HwBody';
import MessagesBody from './subtabs/MessagesBody';
import SwingsBody from './subtabs/SwingsBody';

type SubTab = NonNullable<WorkStackScreenProps<'WorkHome'>['route']['params']>['initialSubTab'];
type Route = WorkStackScreenProps<'WorkHome'>['route'];

const TABS: { key: NonNullable<SubTab>; label: string }[] = [
  { key: 'swings', label: 'Swings' },
  { key: 'assign', label: 'Assign' },
  { key: 'messages', label: 'Messages' },
  { key: 'hw', label: 'HW' },
  { key: 'drills', label: 'Drills' },
];

export default function WorkScreen() {
  const route = useRoute<Route>();
  const initial = route.params?.initialSubTab ?? 'swings';
  const [tab, setTab] = useState<NonNullable<SubTab>>(initial);

  // If the tab is re-focused with a new initialSubTab param, honour it.
  useEffect(() => {
    if (route.params?.initialSubTab) setTab(route.params.initialSubTab);
  }, [route.params?.initialSubTab]);

  const Body = useMemo(() => {
    switch (tab) {
      case 'assign':
        return AssignBody;
      case 'messages':
        return MessagesBody;
      case 'hw':
        return HwBody;
      case 'drills':
        return DrillsBody;
      case 'swings':
      default:
        return SwingsBody;
    }
  }, [tab]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Work</Text>
        <Text style={styles.subtitle}>Train, review, and message your coach</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ flex: 1 }}>
        <Body />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
  tabBar: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    gap: spacing.base,
  },
  pill: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  pillText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  pillTextActive: { color: colors.dark },
});
