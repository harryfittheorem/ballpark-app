import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

import BookHeader from './components/BookHeader';
import CoachSection from './components/CoachSection';
import DateSection from './components/DateSection';
import SessionTypeSection from './components/SessionTypeSection';
import SummarySection from './components/SummarySection';
import TimeSection from './components/TimeSection';
import { useSessionTypes } from './hooks/useSessionTypes';
import { styles } from './styles';
import type { Slot } from './utils/slots';

export default function BookScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedSessionTypeId, setSelectedSessionTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [coachAutoSelected, setCoachAutoSelected] = useState(false);
  const [eligibleCoachIds, setEligibleCoachIds] = useState<string[]>([]);

  const { data: sessionTypes } = useSessionTypes();
  const selectedSessionType =
    sessionTypes?.find((s) => s.id === selectedSessionTypeId) ?? null;

  // Re-selecting the session type clears date + downstream sections.
  const handleSelectSessionType = useCallback((id: string) => {
    setSelectedSessionTypeId(id);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCoachAutoSelected(false);
    setEligibleCoachIds([]);
  }, []);

  // Re-selecting the date clears slot + coach selection.
  const handleSelectDate = useCallback((ymd: string) => {
    setSelectedDate(ymd);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCoachAutoSelected(false);
    setEligibleCoachIds([]);
  }, []);

  // Selecting a slot stores it and surfaces the eligible coaches for that
  // start time. If only one coach is eligible (the v0.3 reality with Coach
  // Mike), the Coach section renders a read-only auto-selected summary and
  // Summary unlocks immediately. Otherwise the Coach section unlocks with
  // the eligible subset and the parent must explicitly pick one.
  const handleSelectSlot = useCallback((slot: Slot, eligible: string[]) => {
    setSelectedSlot(slot);
    setEligibleCoachIds(eligible);
    if (eligible.length <= 1) {
      setSelectedCoachId(slot.coach_id);
      setCoachAutoSelected(true);
    } else {
      setSelectedCoachId(null);
      setCoachAutoSelected(false);
    }
  }, []);

  const handleSelectCoach = useCallback((coachId: string) => {
    setSelectedCoachId(coachId);
    setCoachAutoSelected(false);
  }, []);

  const dateLocked = selectedSessionTypeId == null;
  const timeLocked = dateLocked || selectedDate == null;
  const coachLocked = timeLocked || selectedSlot == null;
  const summaryLocked = coachLocked || selectedCoachId == null;

  const timeLockedHint = dateLocked
    ? 'Pick a session type first.'
    : 'Pick a date first.';
  const coachLockedHint = timeLocked
    ? timeLockedHint
    : 'Pick a time first.';
  const summaryLockedHint = coachLocked ? coachLockedHint : 'Pick a coach first.';

  const selectedSlotKey = selectedSlot
    ? `${selectedSlot.coach_id}|${selectedSlot.start}`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BookHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SessionTypeSection
            selectedSessionTypeId={selectedSessionTypeId}
            onSelect={handleSelectSessionType}
          />
        </View>
        <View style={styles.section}>
          <DateSection
            locked={dateLocked}
            durationMinutes={selectedSessionType?.duration_minutes ?? null}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        </View>
        <View style={styles.section}>
          <TimeSection
            locked={timeLocked}
            lockedHint={timeLockedHint}
            date={selectedDate}
            durationMinutes={selectedSessionType?.duration_minutes ?? null}
            selectedSlotKey={selectedSlotKey}
            onSelectSlot={handleSelectSlot}
          />
        </View>
        <View style={styles.section}>
          <CoachSection
            locked={coachLocked}
            lockedHint={coachLockedHint}
            autoSelectedCoachId={coachAutoSelected ? selectedCoachId : null}
            eligibleCoachIds={eligibleCoachIds}
            selectedCoachId={selectedCoachId}
            onSelectCoach={handleSelectCoach}
          />
        </View>
        <View style={styles.section}>
          <SummarySection locked={summaryLocked} lockedHint={summaryLockedHint} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
