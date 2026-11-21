import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coachingRequestId, getStaffCoachingRecords, saveManualMeasurement, savePrivateLessonNote, type ManualMeasurement } from '@/api/coaching';
import { useAuth } from '@/hooks/useAuth';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = CoachInboxStackScreenProps<'StaffCoachingRecord'>;
type Mode = 'measurement' | 'note' | 'games';
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function StaffCoachingRecordScreen({ route }: Props) {
  const { bookingId, kidName, locationId, bookingStart } = route.params;
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('measurement');
  const [date, setDate] = useState(today());
  const [average, setAverage] = useState('');
  const [peak, setPeak] = useState('');
  const [unit, setUnit] = useState<'mph' | 'km/h'>('mph');
  const [replaces, setReplaces] = useState<ManualMeasurement | null>(null);
  const [reason, setReason] = useState('');
  const [lessonNumber, setLessonNumber] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestRef = useRef<{ signature: string; id: string } | null>(null);
  const query = useQuery({
    queryKey: ['staff-coaching-records', user?.id, bookingId],
    queryFn: () => getStaffCoachingRecords(bookingId),
    enabled: !!user?.id,
    refetchInterval: 45_000,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    void refetch();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void refetch(); });
    return () => sub.remove();
  }, [refetch]));

  const save = async () => {
    setError('');
    setNotice('');
    const payload = mode === 'measurement'
      ? { recorded_on: date, average_ev: Number(average), peak_ev: Number(peak), unit, ...(replaces ? { replaces_id: replaces.id, correction_reason: reason.trim() } : {}) }
      : { recorded_on: date, lesson_number: Number(lessonNumber), body: body.trim() };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) return setError('Enter a valid date.');
    if (mode === 'measurement' && (!average.trim() || !peak.trim() || !Number.isFinite(Number(average)) || !Number.isFinite(Number(peak)) || Number(average) <= 0 || Number(peak) <= 0 || Number(peak) < Number(average))) return setError('Enter positive average and peak values; peak must be at least average.');
    if (mode === 'measurement' && replaces && !reason.trim()) return setError('A correction reason is required.');
    if (mode === 'note' && (!Number.isInteger(Number(lessonNumber)) || Number(lessonNumber) < 1 || !body.trim())) return setError('Enter a positive lesson number and a private note.');
    const signature = JSON.stringify([mode, bookingId, payload]);
    if (!requestRef.current || requestRef.current.signature !== signature) requestRef.current = { signature, id: coachingRequestId() };
    setSaving(true);
    try {
      if (mode === 'measurement') await saveManualMeasurement(requestRef.current.id, bookingId, payload as Parameters<typeof saveManualMeasurement>[2]);
      else await savePrivateLessonNote(requestRef.current.id, bookingId, payload as Parameters<typeof savePrivateLessonNote>[2]);
      requestRef.current = null;
      setNotice(mode === 'measurement' ? 'Measurement saved to history.' : 'Private lesson note saved.');
      setAverage(''); setPeak(''); setReplaces(null); setReason(''); setLessonNumber(''); setBody('');
      await query.refetch();
    } catch (e) {
      setError(`Could not save: ${errorMessage(e)} Check the server validation message above. Your draft is still here; retry unchanged to safely repeat this request.`);
    } finally { setSaving(false); }
  };

  const measurements = query.data?.measurements ?? [];
  const notes = query.data?.notes ?? [];
  const games = query.data?.games ?? [];
  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.eyebrow}>ROSTER RECORD</Text><Text style={styles.title}>{kidName}</Text>
    <Text style={styles.meta}>Booking {bookingId.slice(0, 8)} · Location {locationId.slice(0, 8)} · {new Date(bookingStart).toLocaleString()}</Text>
    {!query.isPending && !query.isError && <View style={styles.ratingCard}>
      <Text style={styles.section}>Family lesson rating · read-only</Text>
      {query.data?.rating ? <>
        <Text style={styles.recordTitle}>{query.data.rating.score}/5</Text>
        {query.data.rating.comment ? <Text style={styles.note}>{query.data.rating.comment}</Text> : <Text style={styles.helper}>No optional note was included.</Text>}
      </> : <Text style={styles.helper}>No family rating submitted for this lesson.</Text>}
    </View>}
    <View style={styles.tabs}>{(['measurement', 'note', 'games'] as Mode[]).map(m => <Pressable key={m} onPress={() => { setMode(m); setError(''); }} disabled={saving} accessibilityRole="tab" accessibilityState={{ selected: mode === m, disabled: saving }} style={[styles.tab, mode === m && styles.activeTab, saving && styles.disabled]}><Text style={[styles.tabText, mode === m && styles.activeTabText]}>{m === 'measurement' ? 'Exit velocity' : m === 'note' ? 'Private note' : 'Games'}</Text></Pressable>)}</View>
    {mode === 'games' ? <>
      <View style={styles.gamesHeading}><Text style={styles.section}>Family-reported game history</Text><Pressable onPress={() => void query.refetch()} disabled={query.isFetching} accessibilityRole="button" accessibilityLabel="Refresh family game history" style={styles.refresh}><Text style={styles.retryText}>{query.isFetching ? 'Refreshing…' : 'Refresh'}</Text></Pressable></View>
      <Text style={styles.provenance}>SELF-REPORTED · NOT MEASURED · family-entered game statistics, separate from instructor measurements and private notes</Text>
      {query.isPending ? <View style={styles.skeletonStack}><View style={styles.skeleton} /><View style={styles.skeleton} /></View> : query.isError ? <Pressable onPress={() => void query.refetch()} disabled={query.isFetching} style={styles.retry}><Text style={styles.retryText}>Game history unavailable · Retry</Text></Pressable> : games.length ? games.map(game => <View key={game.id} style={styles.history}>
        <View style={styles.gameHeader}><Text style={styles.recordTitle}>{game.played_on}</Text><Text style={styles.selfReported}>SELF-REPORTED</Text></View>
        <View style={styles.gameStats}>{[
          ['AB', game.at_bats], ['HITS', game.hits], ['1B', game.singles], ['2B', game.doubles],
          ['3B', game.triples], ['HR', game.home_runs], ['K', game.strikeouts], ['BB', game.walks], ['RBI', game.rbis],
        ].map(([label, value]) => <View key={label} style={styles.gameStat}><Text style={styles.gameStatLabel}>{label}</Text><Text style={styles.gameStatValue}>{value}</Text></View>)}</View>
        {game.notes ? <View style={styles.gameNote}><Text style={styles.label}>FAMILY NOTES</Text><Text style={styles.note}>{game.notes}</Text></View> : <Text style={styles.helper}>No family notes for this game.</Text>}
      </View>) : <Text style={styles.helper}>No family-reported games recorded for this player.</Text>}
    </> : <>
      <Text style={styles.label}>RECORD DATE</Text><TextInput value={date} onChangeText={setDate} editable={!saving} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Record date" />
      {mode === 'measurement' ? <>
        <Text style={styles.label}>VELOCITY UNIT</Text><View style={styles.inline}>{(['mph', 'km/h'] as const).map(v => <Pressable key={v} onPress={() => setUnit(v)} disabled={saving} style={[styles.choice, unit === v && styles.choiceSelected, saving && styles.disabled]} accessibilityRole="radio" accessibilityState={{ checked: unit === v, disabled: saving }}><Text style={styles.choiceText}>{v}</Text></Pressable>)}</View>
        <View style={styles.inline}><View style={styles.half}><Text style={styles.label}>AVERAGE EV</Text><TextInput value={average} onChangeText={setAverage} editable={!saving} maxLength={10} keyboardType="decimal-pad" placeholder="e.g. 62.4" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Average exit velocity" /></View><View style={styles.half}><Text style={styles.label}>PEAK EV</Text><TextInput value={peak} onChangeText={setPeak} editable={!saving} maxLength={10} keyboardType="decimal-pad" placeholder="e.g. 68.1" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Peak exit velocity" /></View></View>
        <Text style={styles.provenance}>MANUAL ENTRY · not a verified sensor reading</Text>
        {!!measurements.length && <><Text style={styles.section}>Correct a prior entry</Text><Text style={styles.helper}>Corrections append a new record; originals stay in history.</Text>{measurements.map(m => <Pressable key={m.id} onPress={() => setReplaces(replaces?.id === m.id ? null : m)} disabled={saving} style={[styles.history, replaces?.id === m.id && styles.selectedHistory, saving && styles.disabled]} accessibilityRole="radio" accessibilityState={{ checked: replaces?.id === m.id, disabled: saving }}><Text style={styles.recordTitle}>{m.recorded_on} · {m.average_ev} avg / {m.peak_ev} peak {m.unit}</Text><Text style={styles.meta}>Recorded by {m.recorded_by} · Location {m.location_id} · Booking {m.booking_id}</Text></Pressable>)}{replaces && <><Text style={styles.label}>CORRECTION REASON</Text><TextInput value={reason} onChangeText={setReason} editable={!saving} maxLength={3000} placeholder="Explain what needs correcting" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.multiline]} accessibilityLabel="Correction reason" /></>}</>}
      </> : <>
        <Text style={styles.label}>LESSON NUMBER</Text><TextInput value={lessonNumber} onChangeText={setLessonNumber} editable={!saving} maxLength={6} keyboardType="number-pad" placeholder="1" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Lesson number" />
        <Text style={styles.label}>PRIVATE NOTE</Text><TextInput value={body} onChangeText={setBody} editable={!saving} maxLength={10000} placeholder="Coaching observations for your own reference" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.multiline]} accessibilityLabel="Private lesson note" />
        <Text style={styles.provenance}>PRIVATE TO THE RECORDING INSTRUCTOR · no edits or deletion</Text>
      </>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}{!!notice && <Text accessibilityLiveRegion="polite" style={styles.success}>{notice}</Text>}
      <Pressable onPress={() => void save()} disabled={saving} style={[styles.primary, saving && styles.disabled]} accessibilityRole="button"><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save record'}</Text></Pressable>
      {query.isPending ? <View style={styles.skeletonStack}><View style={styles.skeleton} /><View style={styles.skeleton} /></View> : query.isError ? <Pressable onPress={() => void query.refetch()} disabled={query.isFetching} style={styles.retry}><Text style={styles.retryText}>History unavailable · Retry</Text></Pressable> : mode === 'measurement' ?
        <><Text style={styles.section}>Measurement history</Text>{measurements.length ? measurements.map(m => <View key={m.id} style={styles.history}><Text style={styles.recordTitle}>{m.recorded_on} · {m.average_ev} avg / {m.peak_ev} peak {m.unit}</Text><Text style={styles.meta}>Manual · by {m.recorded_by} · location {m.location_id} · booking {m.booking_id}{m.replaces_id ? ` · corrects ${m.replaces_id}` : ''}</Text>{m.correction_reason ? <Text style={styles.meta}>Reason: {m.correction_reason}</Text> : null}</View>) : <Text style={styles.helper}>No manual measurements recorded.</Text>}</> :
        <><Text style={styles.section}>Your private notes</Text>{notes.length ? notes.map(n => <View key={n.id} style={styles.history}><Text style={styles.recordTitle}>Lesson {n.lesson_number} · {n.recorded_on}</Text><Text style={styles.note}>{n.body}</Text><Text style={styles.meta}>Recorded by {n.recorded_by} · location {locationId} · booking {n.booking_id}</Text></View>) : <Text style={styles.helper}>No private notes recorded.</Text>}</>}
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest }, content: { padding: spacing['3xl'], paddingBottom: spacing['5xl'], gap: spacing.md },
  eyebrow: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.sm, letterSpacing: 1.4 },
  title: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: 30 }, meta: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.xs, lineHeight: 18 },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md }, tab: { flex: 1, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }, activeTab: { backgroundColor: colors.gold, borderColor: colors.gold }, tabText: { color: colors.textLight, fontFamily: fontFamilies.interBold }, activeTabText: { color: colors.dark },
  label: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xs, letterSpacing: 1, marginTop: spacing.sm }, input: { backgroundColor: colors.darker, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.cream, padding: spacing.lg, fontSize: fontSizes.md, minHeight: 48 }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  inline: { flexDirection: 'row', gap: spacing.md }, half: { flex: 1 }, choice: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md }, choiceSelected: { borderColor: colors.gold, backgroundColor: colors.darker }, choiceText: { color: colors.cream, fontFamily: fontFamilies.interBold },
  provenance: { color: colors.textMuted, fontFamily: fontFamilies.oswaldBold, fontSize: 10, letterSpacing: 1, marginVertical: spacing.md }, section: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg, marginTop: spacing['2xl'] }, helper: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm },
  history: { padding: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.darker, gap: 5 }, selectedHistory: { borderColor: colors.gold }, recordTitle: { color: colors.cream, fontFamily: fontFamilies.interBold, fontSize: fontSizes.sm }, note: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm, lineHeight: 20 },
  ratingCard: { padding: spacing.lg, borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, backgroundColor: colors.darker, gap: spacing.xs },
  gamesHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }, refresh: { padding: spacing.sm }, selfReported: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: 9, letterSpacing: 0.8, borderColor: colors.gold, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  gameHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }, gameStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, gameStat: { width: '30%', paddingVertical: spacing.xs }, gameStatLabel: { color: colors.textMuted, fontFamily: fontFamilies.oswaldBold, fontSize: 9, letterSpacing: 0.7 }, gameStatValue: { color: colors.cream, fontFamily: fontFamilies.interBold, fontSize: fontSizes.md }, gameNote: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs },
  skeletonStack: { gap: spacing.md }, skeleton: { height: 74, backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md },
  primary: { backgroundColor: colors.gold, alignItems: 'center', padding: spacing.lg, borderRadius: radius.md, marginTop: spacing.md }, disabled: { opacity: 0.6 }, primaryText: { color: colors.dark, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.md, textTransform: 'uppercase' }, error: { color: '#F87171', fontSize: fontSizes.sm }, success: { color: '#34D399', fontSize: fontSizes.sm }, retry: { padding: spacing.md, alignItems: 'center' }, retryText: { color: colors.gold, fontFamily: fontFamilies.interBold },
});
