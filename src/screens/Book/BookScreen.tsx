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

export default function BookScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [selectedSessionTypeId, setSelectedSessionTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: sessionTypes } = useSessionTypes();
  const selectedSessionType =
    sessionTypes?.find((s) => s.id === selectedSessionTypeId) ?? null;

  // Re-selecting the session type clears the date so Time re-locks.
  const handleSelectSessionType = useCallback((id: string) => {
    setSelectedSessionTypeId(id);
    setSelectedDate(null);
  }, []);

  const dateLocked = selectedSessionTypeId == null;
  const timeLocked = dateLocked || selectedDate == null;
  const timeLockedHint = dateLocked
    ? 'Pick a session type first.'
    : 'Pick a date first.';

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
            onSelectDate={setSelectedDate}
          />
        </View>
        <View style={styles.section}>
          <TimeSection locked={timeLocked} lockedHint={timeLockedHint} />
        </View>
        <View style={styles.section}>
          <CoachSection />
        </View>
        <View style={styles.section}>
          <SummarySection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
