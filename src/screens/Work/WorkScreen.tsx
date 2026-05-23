import { useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAssignments } from '@/hooks/useAssignments';
import { useCoachMessagesForKid } from '@/hooks/useCoachMessages';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useSwingsForKid } from '@/hooks/useSwings';
import { useTrainingVideos } from '@/hooks/useTrainingVideos';
import KidSwitcherPill from '@/components/ui/KidSwitcherPill';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import AssignBody from './subtabs/AssignBody';
import DrillsBody from './subtabs/DrillsBody';
import HwBody from './subtabs/HwBody';
import MessagesBody from './subtabs/MessagesBody';
import SwingsBody from './subtabs/SwingsBody';

type SubTab = NonNullable<WorkStackScreenProps<'WorkHome'>['route']['params']>['initialSubTab'];
type Route = WorkStackScreenProps<'WorkHome'>['route'];

type TabKey = NonNullable<SubTab>;
const TABS: { key: TabKey; label: string }[] = [
  { key: 'swings', label: 'Swings' },
  { key: 'assign', label: 'Assign' },
  { key: 'messages', label: 'Messages' },
  { key: 'hw', label: 'HW' },
  { key: 'drills', label: 'Drills' },
];

function fmtCount(n: number): string {
  if (n <= 0) return '';
  if (n >= 100) return '99+';
  return String(n);
}

export default function WorkScreen() {
  const route = useRoute<Route>();
  const initial = route.params?.initialSubTab ?? 'swings';
  const [tab, setTab] = useState<TabKey>(initial);

  // If the tab is re-focused with a new initialSubTab param, honour it.
  useEffect(() => {
    if (route.params?.initialSubTab) setTab(route.params.initialSubTab);
  }, [route.params?.initialSubTab]);

  // Sub-tab count badges. We fan out the same hooks the bodies already
  // use so React Query dedupes and the badges stay live in sync.
  const { kid } = useSelectedKid();
  const { data: swings } = useSwingsForKid(kid?.id);
  const { data: assignments } = useAssignments(kid?.id);
  const { data: coachMsgs } = useCoachMessagesForKid(kid?.id);
  const { data: drills } = useTrainingVideos('all');

  const counts = useMemo<Record<TabKey, string>>(() => {
    const swingsTotal = swings?.length ?? 0;
    const pendingAssign = (assignments ?? []).filter((a) => a.status === 'pending').length;
    const newMsgs = (coachMsgs ?? []).filter((m) => !m.viewedAt).length;
    const reviewed = (assignments ?? []).filter(
      (a) => a.status === 'submitted' || a.status === 'reviewed',
    ).length;
    const drillsTotal = drills?.length ?? 0;
    return {
      swings: fmtCount(swingsTotal),
      assign: fmtCount(pendingAssign),
      messages: fmtCount(newMsgs),
      hw: fmtCount(reviewed),
      drills: fmtCount(drillsTotal),
    };
  }, [swings, assignments, coachMsgs, drills]);

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

  // Keyboard avoidance is lifted here so it wraps only the body area,
  // sitting below the SafeAreaView + header + sub-tab bar. This means
  // the KAV's effective offset is zero — the view above it is already
  // outside the KAV and the system correctly measures from here.
  // On Android we leave behavior undefined (same as every other screen).
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Work</Text>
          <KidSwitcherPill />
        </View>
        <Text style={styles.subtitle}>Train, review, and message your coach</Text>
      </View>
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((t) => {
          const active = tab === t.key;
          const count = counts[t.key];
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.pill, active && styles.pillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={count ? `${t.label}, ${count}` : t.label}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{t.label}</Text>
              {count ? (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
          })}
        </ScrollView>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Body />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
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
  tabBarWrapper: { flexShrink: 0 },
  tabBar: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.base,
    gap: spacing.base,
    alignItems: 'flex-start',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.base,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  pillActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  badge: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: { backgroundColor: colors.dark },
  badgeText: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
  },
  badgeTextActive: { color: colors.gold },
  pillText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },
  pillTextActive: { color: colors.dark },
});
