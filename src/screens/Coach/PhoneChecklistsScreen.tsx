import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Check, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { completePhoneChecklist, getPhoneChecklists, type PhoneChecklist } from '@/api/coaching';
import { useAuth } from '@/hooks/useAuth';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

function checklistKey(actorId: string | undefined, item: PhoneChecklist) {
  return `${actorId ?? 'signed-out'}:${item.assignment_id}:${item.lesson_id}`;
}

export default function PhoneChecklistsScreen() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['phone-assigned-checklists', user?.id], queryFn: getPhoneChecklists, enabled: !!user, refetchInterval: 45_000 });
  const { refetch } = query;
  const records = query.data;
  const [checked, setChecked] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>());
  useFocusEffect(useCallback(() => {
    void refetch();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void refetch(); });
    return () => sub.remove();
  }, [refetch]));
  useEffect(() => {
    if (!records) return;
    setChecked(prev => {
      const next = { ...prev };
      records.forEach(item => {
        const id = checklistKey(user?.id, item);
        if (item.completed) next[id] = item.items.map((_, i) => i);
        else if (next[id] === undefined) next[id] = [];
      });
      return next;
    });
  }, [records, user?.id]);
  const toggle = (item: PhoneChecklist, index: number) => {
    if (item.completed) return;
    const id = checklistKey(user?.id, item);
    const previous = checked[id] ?? (item.completed ? item.items.map((_, i) => i) : []);
    const next = previous.includes(index) ? previous.filter(v => v !== index) : [...previous, index].sort((a, b) => a - b);
    setChecked(prev => ({ ...prev, [id]: next }));
    setFeedback(prev => ({ ...prev, [id]: '' }));
  };
  const complete = async (item: PhoneChecklist) => {
    const id = checklistKey(user?.id, item);
    if (item.completed || inFlight.current.has(id)) return;
    const selected = checked[id] ?? [];
    if (selected.length !== item.items.length || item.items.length === 0) {
      setFeedback(prev => ({ ...prev, [id]: 'Check every item before completing this lesson.' }));
      return;
    }
    inFlight.current.add(id);
    setSaving(prev => ({ ...prev, [id]: true }));
    setFeedback(prev => ({ ...prev, [id]: '' }));
    try {
      await completePhoneChecklist(item.assignment_id, item.lesson_id, selected);
      await query.refetch();
    } catch (e) {
      setFeedback(prev => ({ ...prev, [id]: `Could not complete checklist: ${errorMessage(e)} The completion was not confirmed. Retry when ready.` }));
    } finally {
      inFlight.current.delete(id);
      setSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>ASSIGNED TRAINING</Text><Text style={styles.title}>Phone checklists</Text><Text style={styles.intro}>Only published lessons assigned to you appear here.</Text>
    {!user ? <View style={styles.empty}><Text style={styles.emptyTitle}>Sign in to view assigned checklists</Text><Text style={styles.intro}>Your published training assignments will be available after sign-in.</Text></View> : query.isPending ? <View style={styles.center}><View style={styles.skeleton} /><View style={styles.skeleton} /><View style={styles.skeletonShort} /></View> : query.isError ? <View style={styles.empty}><Text style={styles.error}>{errorMessage(query.error)}</Text><Pressable style={styles.retry} onPress={() => void query.refetch()}><RefreshCw size={16} color={colors.gold} /><Text style={styles.retryText}>Retry</Text></Pressable></View> : query.data?.length ? query.data.map(item => {
      const id = checklistKey(user?.id, item);
      const selected = checked[id] ?? (item.completed ? item.items.map((_, i) => i) : []);
      return <View key={id} style={styles.card}><View style={styles.cardHead}><View style={{ flex: 1 }}><Text style={styles.course}>{item.course_title}</Text><Text style={styles.lesson}>{item.title}</Text></View><Text style={[styles.status, item.completed && styles.statusDone]}>{item.completed ? 'COMPLETE' : 'IN PROGRESS'}</Text></View>
        {item.items.map((label, index) => {
          const active = selected.includes(index);
          return <Pressable key={`${id}:${index}`} onPress={() => toggle(item, index)} disabled={item.completed || saving[id]} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: active, disabled: item.completed || !!saving[id] }} accessibilityLabel={label}><View style={[styles.box, active && styles.boxChecked, item.completed && styles.boxReadOnly]}>{active ? <Check size={15} color={colors.dark} /> : null}</View><Text style={[styles.itemText, active && styles.itemTextChecked]}>{label}</Text></Pressable>;
        })}
        {!item.completed && <Pressable onPress={() => void complete(item)} disabled={saving[id] || selected.length !== item.items.length || item.items.length === 0} style={[styles.completeButton, (saving[id] || selected.length !== item.items.length || item.items.length === 0) && styles.disabled]} accessibilityRole="button"><Text style={styles.completeText}>{saving[id] ? 'Saving completion…' : 'Complete checklist'}</Text></Pressable>}
        {saving[id] ? <Text style={styles.saving}>Saving completion…</Text> : feedback[id] ? <Text accessibilityLiveRegion="polite" style={styles.error}>{feedback[id]}</Text> : null}
      </View>;
    }) : <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing assigned yet</Text><Text style={styles.intro}>Published training checklists assigned to your account will show here.</Text><Pressable style={styles.retry} onPress={() => void query.refetch()}><RefreshCw size={16} color={colors.gold} /><Text style={styles.retryText}>Refresh</Text></Pressable></View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest }, content: { padding: spacing['3xl'], paddingBottom: spacing['5xl'], gap: spacing.md }, kicker: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, letterSpacing: 1.5 }, title: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: 30 }, intro: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm, lineHeight: 20 },
  center: { gap: spacing.md, paddingTop: spacing['3xl'] }, skeleton: { height: 120, backgroundColor: colors.darker, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, skeletonShort: { height: 24, width: '60%', backgroundColor: colors.darker, borderRadius: radius.md }, card: { backgroundColor: colors.darker, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }, course: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xs, textTransform: 'uppercase', letterSpacing: 1 }, lesson: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg, marginTop: 4 }, status: { color: colors.textLight, fontFamily: fontFamilies.oswaldBold, fontSize: 9, borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4 }, statusDone: { borderColor: '#34D399', color: '#34D399' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, minHeight: 50 }, box: { width: 25, height: 25, borderWidth: 1, borderColor: colors.textMuted, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, boxChecked: { backgroundColor: colors.gold, borderColor: colors.gold }, boxReadOnly: { opacity: 0.75 }, itemText: { flex: 1, color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm }, itemTextChecked: { color: colors.cream }, saving: { color: colors.textLight, fontSize: fontSizes.xs }, error: { color: '#F87171', fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm, lineHeight: 19 },
  completeButton: { alignItems: 'center', backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm }, completeText: { color: colors.dark, fontFamily: fontFamilies.oswaldBold, textTransform: 'uppercase' }, disabled: { opacity: 0.45 },
  empty: { alignItems: 'center', padding: spacing['3xl'], gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.darker, marginTop: spacing['2xl'] }, emptyTitle: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg }, retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, padding: spacing.md }, retryText: { color: colors.gold, fontFamily: fontFamilies.interBold },
});
