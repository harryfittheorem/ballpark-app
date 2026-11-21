import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coachingRequestId, getFamilyCoachingRecords, rateLesson, saveGameStats } from '@/api/coaching';
import type { GameInput, RateableLesson } from '@/api/coaching';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const dateToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
};
const fields: Array<{ key: keyof Omit<GameInput, 'played_on' | 'notes'>; label: string }> = [
  { key: 'at_bats', label: 'At-bats' }, { key: 'singles', label: 'Singles' }, { key: 'doubles', label: 'Doubles' },
  { key: 'triples', label: 'Triples' }, { key: 'home_runs', label: 'Home runs' }, { key: 'strikeouts', label: 'Strikeouts' },
  { key: 'walks', label: 'Walks' }, { key: 'rbis', label: 'RBIs' },
];
type RatingDraft = { score: number; comment: string; error: string; saving: boolean };

export default function FamilyCoachingScreen() {
  const { user } = useAuth();
  const { kid, kids, setSelectedKid, loading } = useSelectedKid();
  const [playedOn, setPlayedOn] = useState(dateToday());
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [gameError, setGameError] = useState('');
  const [gameStatus, setGameStatus] = useState('');
  const [savingGame, setSavingGame] = useState(false);
  const requestRef = useRef<{ signature: string; id: string } | null>(null);
  const ratingRequests = useRef(new Set<string>());
  const [drafts, setDrafts] = useState<Record<string, RatingDraft>>({});
  const query = useQuery({
    queryKey: ['family-coaching-records', user?.id, kid?.id],
    queryFn: () => getFamilyCoachingRecords(kid!.id),
    enabled: !!user?.id && !!kid?.id,
    refetchInterval: 45_000,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (kid?.id) void refetch();
    const sub = AppState.addEventListener('change', state => { if (state === 'active' && kid?.id) void refetch(); });
    return () => sub.remove();
  }, [kid?.id, refetch]));

  const submitGame = async () => {
    setGameError(''); setGameStatus('');
    if (!kid) return;
    if (!validDate(playedOn)) return setGameError('Enter a real calendar date in YYYY-MM-DD format.');
    if (fields.some(({ key }) => !numbers[key]?.trim())) return setGameError('Enter every game stat. Use 0 where no stat was recorded.');
    const values = Object.fromEntries(fields.map(({ key }) => [key, Number(numbers[key] ?? '0')])) as Record<string, number>;
    if (fields.some(({ key }) => !Number.isInteger(values[key]) || values[key] < 0)) return setGameError('Use whole numbers of zero or greater for every stat.');
    const hitCount = values.singles + values.doubles + values.triples + values.home_runs;
    if (hitCount > values.at_bats) return setGameError('Total hits cannot exceed at-bats.');
    const input: GameInput = { played_on: playedOn, ...values, notes: notes.trim() } as GameInput;
    const signature = JSON.stringify([kid.id, input]);
    const requestId = requestRef.current?.signature === signature ? requestRef.current.id : coachingRequestId();
    requestRef.current = { signature, id: requestId };
    setSavingGame(true);
    try {
      await saveGameStats(requestId, kid.id, input);
      requestRef.current = null; setGameStatus('Game stats saved. These remain self-reported, separate from measured training.');
      setNumbers({}); setNotes(''); await query.refetch();
    } catch (e) { setGameError(`Could not save. Server response: ${errorMessage(e)} Your entries are retained; retry unchanged to safely repeat this request.`); }
    finally { setSavingGame(false); }
  };

  const submitRating = async (lesson: RateableLesson) => {
    if (ratingRequests.current.has(lesson.id)) return;
    const draft = drafts[lesson.id];
    if (!draft?.score) {
      setDrafts(prev => ({ ...prev, [lesson.id]: { ...(prev[lesson.id] ?? { score: 0, comment: '', saving: false }), error: 'Choose a rating from 1 to 5.' } }));
      return;
    }
    ratingRequests.current.add(lesson.id);
    setDrafts(prev => ({ ...prev, [lesson.id]: { ...draft, error: '', saving: true } }));
    try {
      await rateLesson(lesson.id, draft.score, draft.comment.trim());
      setDrafts(prev => ({ ...prev, [lesson.id]: { ...draft, saving: false, error: '' } }));
      await query.refetch();
    } catch (e) {
      setDrafts(prev => ({ ...prev, [lesson.id]: { ...draft, saving: false, error: `Could not submit rating. Server response: ${errorMessage(e)} Refresh to check whether it was received; ratings cannot be changed.` } }));
      await query.refetch();
    } finally {
      ratingRequests.current.delete(lesson.id);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={query.isFetching && !query.isPending} onRefresh={() => void query.refetch()} tintColor={colors.gold} colors={[colors.gold]} />}>
    <Text style={styles.kicker}>ATHLETE PROGRESS</Text><Text style={styles.title}>{kid ? `${kid.first_name} ${kid.last_name ?? ''}`.trim() : 'Family progress'}</Text>
    {kids.length > 1 && <View style={styles.kidTabs}>{kids.map(k => <Pressable key={k.id} onPress={() => {
      if (savingGame) return;
      setPlayedOn(dateToday()); setNumbers({}); setNotes(''); setGameError(''); setGameStatus(''); requestRef.current = null; setDrafts({});
      setSelectedKid(k.id);
    }} disabled={savingGame} accessibilityRole="tab" accessibilityState={{ selected: k.id === kid?.id, disabled: savingGame }} style={[styles.kidTab, k.id === kid?.id && styles.kidTabActive, savingGame && styles.disabled]}><Text style={[styles.kidTabText, k.id === kid?.id && styles.kidTabActiveText]}>{k.first_name}</Text></Pressable>)}</View>}
    {loading ? <View style={styles.center}><View style={styles.skeleton} /><View style={styles.skeleton} /></View> : !kid ? <Text style={styles.helper}>Add an athlete to start tracking training.</Text> : query.isPending ? <View style={styles.center}><View style={styles.skeleton} /><View style={styles.skeleton} /><Text style={styles.helper}>Loading training history…</Text></View> : query.isError ? <View style={styles.panel}><Text style={styles.error}>{errorMessage(query.error)}</Text><Pressable style={styles.secondary} onPress={() => void query.refetch()}><Text style={styles.secondaryText}>Retry loading</Text></Pressable></View> : <>
      <View style={styles.callout}><Text style={styles.calloutTitle}>SELF-REPORTED GAMES</Text><Text style={styles.helper}>Family-entered game stats are shown separately from verified, measured training.</Text></View>
      <Text style={styles.section}>Add a game</Text>
      <Text style={styles.label}>GAME DATE</Text><TextInput value={playedOn} onChangeText={setPlayedOn} editable={!savingGame} maxLength={10} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Game date" />
      <View style={styles.statsGrid}>{fields.map(({ key, label }) => <View key={key} style={styles.statField}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput value={numbers[key] ?? ''} onChangeText={v => setNumbers(prev => ({ ...prev, [key]: v }))} editable={!savingGame} maxLength={7} keyboardType="number-pad" placeholder="Enter 0 if none" placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel={label} /></View>)}</View>
      <Text style={styles.computed}>HITS {fields.filter(f => ['singles', 'doubles', 'triples', 'home_runs'].includes(f.key)).reduce((sum, f) => sum + Number(numbers[f.key] ?? 0), 0)}</Text>
      <Text style={styles.label}>NOTES</Text><TextInput value={notes} onChangeText={setNotes} editable={!savingGame} maxLength={3000} placeholder="Optional context from the game" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.multiline]} accessibilityLabel="Game notes" />
      {!!gameError && <Text accessibilityRole="alert" style={styles.error}>{gameError}</Text>}{!!gameStatus && <Text accessibilityLiveRegion="polite" style={styles.success}>{gameStatus}</Text>}
      <Pressable onPress={() => void submitGame()} disabled={savingGame} style={[styles.primary, savingGame && styles.disabled]} accessibilityRole="button"><Text style={styles.primaryText}>{savingGame ? 'Saving…' : 'Save game stats'}</Text></Pressable>
      <Text style={styles.section}>Game history</Text>{query.data?.games.length ? query.data.games.map(g => <View key={g.id} style={styles.panel}><View style={styles.row}><Text style={styles.panelTitle}>{g.played_on}</Text><Text style={styles.selfBadge}>SELF-REPORTED</Text></View><Text style={styles.gameLine}>{g.hits} H · {g.at_bats} AB · {g.doubles} 2B · {g.triples} 3B · {g.home_runs} HR</Text><Text style={styles.helper}>K {g.strikeouts} · BB {g.walks} · RBI {g.rbis}</Text>{g.notes ? <Text style={styles.helper}>{g.notes}</Text> : null}</View>) : <Text style={styles.helper}>No games entered yet.</Text>}
      <Text style={styles.section}>Rate a lesson</Text><Text style={styles.helper}>Ratings and comments are visible to authorized staff. Reporting includes rating averages from numeric scores only; comments are not included. A submitted rating cannot be changed.</Text>
      {(query.data?.lessons ?? []).map(lesson => <LessonCard key={lesson.id} lesson={lesson} draft={drafts[lesson.id]} onChange={patch => setDrafts(prev => {
        const current = prev[lesson.id] ?? { score: 0, comment: '', saving: false, error: '' };
        return { ...prev, [lesson.id]: { ...current, ...patch } };
      })} onSubmit={() => void submitRating(lesson)} />)}
      {!(query.data?.lessons.length) && <Text style={styles.helper}>No completed Hitting Lessons are available to rate.</Text>}
    </>}
  </ScrollView></SafeAreaView>;
}

function LessonCard({ lesson, draft, onChange, onSubmit }: { lesson: RateableLesson; draft?: RatingDraft; onChange: (patch: Partial<RatingDraft>) => void; onSubmit: () => void }) {
  const date = new Date(lesson.scheduled_start);
  const dateText = Number.isNaN(date.getTime()) ? lesson.scheduled_start : date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return <View style={styles.panel}><Text style={styles.panelTitle}>{lesson.type_name}</Text><Text style={styles.helper}>{dateText} · {lesson.instructor}</Text>{lesson.rating ? <View style={styles.rated}><Text style={styles.success}>Rating received · {lesson.rating.score}/5</Text>{lesson.rating.comment ? <Text style={styles.helper}>{lesson.rating.comment}</Text> : null}</View> : <>
    <Text style={styles.label}>YOUR RATING</Text><View style={styles.stars}>{[1,2,3,4,5].map(score => <Pressable key={score} onPress={() => onChange({ score, error: '' })} disabled={draft?.saving} accessibilityRole="radio" accessibilityLabel={`${score} out of 5`} accessibilityState={{ checked: draft?.score === score, disabled: !!draft?.saving }} style={[styles.starButton, draft?.saving && styles.disabled]}><Star size={30} color={colors.gold} fill={(draft?.score ?? 0) >= score ? colors.gold : 'transparent'} /></Pressable>)}</View>
    <TextInput value={draft?.comment ?? ''} onChangeText={comment => onChange({ comment, error: '' })} editable={!draft?.saving} maxLength={3000} placeholder="Optional note for the instructor" placeholderTextColor={colors.textMuted} multiline style={[styles.input, styles.multiline, draft?.saving && styles.disabled]} accessibilityLabel="Optional lesson comment" />
    {!!draft?.error && <Text accessibilityRole="alert" style={styles.error}>{draft.error}</Text>}<Pressable onPress={onSubmit} disabled={draft?.saving} style={[styles.secondary, draft?.saving && styles.disabled]}><Text style={styles.secondaryText}>{draft?.saving ? 'Sending…' : 'Submit lesson rating'}</Text></Pressable>
  </>}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest }, content: { padding: spacing['3xl'], paddingBottom: spacing['5xl'], gap: spacing.md },
  kicker: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.sm, letterSpacing: 1.5 }, title: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: 30 },
  kidTabs: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.sm }, kidTab: { borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full }, kidTabActive: { backgroundColor: colors.gold, borderColor: colors.gold }, kidTabText: { color: colors.textLight, fontFamily: fontFamilies.interBold }, kidTabActiveText: { color: colors.dark },
  center: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: spacing.md }, section: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xl, marginTop: spacing['2xl'] },
  skeleton: { width: '100%', height: 86, backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  callout: { padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.gold, gap: 5 }, calloutTitle: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, letterSpacing: 1 }, helper: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm, lineHeight: 19 },
  label: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: 10, letterSpacing: 1, marginTop: spacing.sm }, input: { backgroundColor: colors.darker, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.cream, padding: spacing.md, fontSize: fontSizes.md, minHeight: 46 }, multiline: { minHeight: 76, textAlignVertical: 'top' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, statField: { width: '47%' }, computed: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg, paddingVertical: spacing.sm },
  primary: { backgroundColor: colors.gold, alignItems: 'center', padding: spacing.lg, borderRadius: radius.md }, primaryText: { color: colors.dark, fontFamily: fontFamilies.oswaldBold, textTransform: 'uppercase' }, secondary: { borderWidth: 1, borderColor: colors.gold, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md }, secondaryText: { color: colors.gold, fontFamily: fontFamilies.interBold },
  panel: { backgroundColor: colors.darker, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }, panelTitle: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.md }, selfBadge: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: 9, letterSpacing: 0.7, borderColor: colors.gold, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 }, gameLine: { color: colors.cream, fontFamily: fontFamilies.interBold, fontSize: fontSizes.sm },
  stars: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm }, starButton: { padding: spacing.xs }, rated: { gap: spacing.xs, marginTop: spacing.sm }, error: { color: '#F87171', fontSize: fontSizes.sm, lineHeight: 18 }, success: { color: '#34D399', fontFamily: fontFamilies.interBold, fontSize: fontSizes.sm }, disabled: { opacity: 0.55 },
});
