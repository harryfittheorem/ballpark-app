/**
 * BookScreen — task #135 (round 3).
 *
 * Customer-finalized v0.4 design: a top-level Book tab that wraps the
 * existing v0.3 booking wizard inside a 4-sub-tab shell:
 *
 *   ALL · PRIVATE LESSONS · GROUP CLASSES · CAGE RENTALS
 *
 * Plus three required surfaces around the wizard:
 *   - "Your upcoming" — next 1–3 bookings the family already has.
 *   - "What can I book?" — the existing SessionTypeSection, now filtered
 *     by the active sub-tab's `type_category`.
 *   - "Today / Tomorrow open slots" — quick-pick chips that pre-seed the
 *     wizard's date so the parent can jump straight into picking a time.
 *
 * The existing booking-flow components are reused verbatim — only the
 * shell + the SessionTypeSection category filter are new.
 */

import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Calendar, ChevronRight, Clock } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useFamilyBookings } from '@/hooks/useFamilyBookings';
import type { MainTabScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import BookHeader from './components/BookHeader';
import CoachSection from './components/CoachSection';
import DateSection from './components/DateSection';
import SessionTypeSection from './components/SessionTypeSection';
import SummarySection from './components/SummarySection';
import TimeSection from './components/TimeSection';
import { useSessionTypes } from './hooks/useSessionTypes';
import { styles as flowStyles } from './styles';
import type { Slot } from './utils/slots';

type Category = 'all' | 'private' | 'group' | 'cage';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'private', label: 'Private Lessons' },
  { key: 'group', label: 'Group Classes' },
  { key: 'cage', label: 'Cage Rentals' },
];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function BookScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<MainTabScreenProps<'Book'>['navigation']>();
  const { showToast } = useToast();

  // Sub-tab filter for "What can I book?".
  const [category, setCategory] = useState<Category>('all');

  // ---- Wizard state (lifted from the v0.3 BookScreen) ----------------------
  const [selectedSessionTypeId, setSelectedSessionTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [coachAutoSelected, setCoachAutoSelected] = useState(false);
  const [eligibleCoachIds, setEligibleCoachIds] = useState<string[]>([]);

  const { data: sessionTypes } = useSessionTypes();
  const selectedSessionType =
    sessionTypes?.find((s) => s.id === selectedSessionTypeId) ?? null;

  const { data: bookings } = useFamilyBookings();
  const upcoming = useMemo(() => {
    if (!bookings) return [];
    const now = Date.now();
    return bookings
      .filter((b) => b.status !== 'cancelled' && new Date(b.scheduled_start).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      )
      .slice(0, 3);
  }, [bookings]);

  // Re-selecting the session type clears date + downstream sections.
  const handleSelectSessionType = useCallback((id: string) => {
    setSelectedSessionTypeId(id);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCoachAutoSelected(false);
    setEligibleCoachIds([]);
  }, []);

  const handleSelectDate = useCallback((d: string) => {
    setSelectedDate(d);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCoachAutoSelected(false);
    setEligibleCoachIds([]);
  }, []);

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

  const timeLockedHint = dateLocked ? 'Pick a session type first.' : 'Pick a date first.';
  const coachLockedHint = timeLocked ? timeLockedHint : 'Pick a time first.';
  const summaryLockedHint = coachLocked ? coachLockedHint : 'Pick a coach first.';

  const selectedSlotKey = selectedSlot
    ? `${selectedSlot.coach_id}|${selectedSlot.start}`
    : null;

  const resetSelection = useCallback(() => {
    setSelectedSessionTypeId(null);
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCoachAutoSelected(false);
    setEligibleCoachIds([]);
  }, []);

  const handleBooked = useCallback(
    (formattedWhen: string) => {
      resetSelection();
      navigation.navigate('Home', { screen: 'HomeMain' });
      showToast(`Session booked for ${formattedWhen}`);
    },
    [navigation, resetSelection, showToast],
  );

  // Today / Tomorrow quick-pick — pre-seeds the wizard's date so the
  // parent can immediately scroll into TimeSection.
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const todayYmd = ymd(today);
  const tomorrowYmd = ymd(tomorrow);

  const onPickDay = (d: string) => {
    if (!selectedSessionTypeId) {
      showToast('Pick a session type first to see open slots.');
      return;
    }
    handleSelectDate(d);
  };

  return (
    <SafeAreaView style={flowStyles.safe} edges={['top']}>
      <BookHeader />
      <ScrollView
        style={flowStyles.scroll}
        contentContainerStyle={[
          flowStyles.scrollContent,
          { paddingBottom: tabBarHeight + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sub-tab pills ---------------------------------------------------- */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={shellStyles.tabBar}
        >
          {CATEGORIES.map((c) => {
            const active = c.key === category;
            return (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[shellStyles.pill, active && shellStyles.pillActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[shellStyles.pillText, active && shellStyles.pillTextActive]}
                >
                  {c.label.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Your upcoming --------------------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>YOUR UPCOMING</Text>
          {upcoming.length === 0 ? (
            <View style={shellStyles.emptyCard}>
              <Calendar size={18} color={colors.gold} />
              <Text style={shellStyles.emptyText}>
                No upcoming sessions. Pick one below.
              </Text>
            </View>
          ) : (
            upcoming.map((b) => {
              const start = new Date(b.scheduled_start);
              const when = start.toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
              const sub = [
                b.session_type?.name ?? 'Session',
                b.coach ? `with ${b.coach.first_name}` : null,
                b.location?.name ?? null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    navigation.navigate('Me', {
                      screen: 'BookingDetail',
                      params: { bookingId: b.id },
                    })
                  }
                  style={({ pressed }) => [
                    shellStyles.upcomingRow,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={shellStyles.upcomingWhen}>{when.toUpperCase()}</Text>
                    <Text style={shellStyles.upcomingSub}>{sub}</Text>
                  </View>
                  <ChevronRight size={18} color={colors.textLight} />
                </Pressable>
              );
            })
          )}
        </View>

        {/* "What can I book?" ---------------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>WHAT CAN I BOOK?</Text>
          <SessionTypeSection
            selectedSessionTypeId={selectedSessionTypeId}
            onSelect={handleSelectSessionType}
            categoryFilter={category}
          />
        </View>

        {/* Today / Tomorrow open slots ------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>TODAY / TOMORROW</Text>
          <View style={shellStyles.dayChipRow}>
            <DayChip
              label="TODAY"
              date={todayYmd}
              active={selectedDate === todayYmd}
              onPress={() => onPickDay(todayYmd)}
            />
            <DayChip
              label="TOMORROW"
              date={tomorrowYmd}
              active={selectedDate === tomorrowYmd}
              onPress={() => onPickDay(tomorrowYmd)}
            />
          </View>
        </View>

        {/* Existing wizard ------------------------------------------------- */}
        <View style={flowStyles.section}>
          <DateSection
            locked={dateLocked}
            durationMinutes={selectedSessionType?.duration_minutes ?? null}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />
        </View>
        <View style={flowStyles.section}>
          <TimeSection
            locked={timeLocked}
            lockedHint={timeLockedHint}
            date={selectedDate}
            durationMinutes={selectedSessionType?.duration_minutes ?? null}
            selectedSlotKey={selectedSlotKey}
            onSelectSlot={handleSelectSlot}
          />
        </View>
        <View style={flowStyles.section}>
          <CoachSection
            locked={coachLocked}
            lockedHint={coachLockedHint}
            autoSelectedCoachId={coachAutoSelected ? selectedCoachId : null}
            eligibleCoachIds={eligibleCoachIds}
            selectedCoachId={selectedCoachId}
            onSelectCoach={handleSelectCoach}
          />
        </View>
        <View style={flowStyles.section}>
          <SummarySection
            locked={summaryLocked}
            lockedHint={summaryLockedHint}
            sessionType={selectedSessionType}
            date={selectedDate}
            slot={selectedSlot}
            selectedCoachId={selectedCoachId}
            onBooked={handleBooked}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DayChip({
  label,
  date,
  active,
  onPress,
}: {
  label: string;
  date: string;
  active: boolean;
  onPress: () => void;
}) {
  // Pretty short date on the chip — e.g. "MAY 9".
  const d = new Date(`${date}T00:00:00`);
  const sub = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shellStyles.dayChip,
        active && shellStyles.dayChipActive,
        pressed && { opacity: 0.9 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${sub}`}
    >
      <Clock size={16} color={active ? colors.dark : colors.gold} />
      <View>
        <Text style={[shellStyles.dayChipText, active && shellStyles.dayChipTextActive]}>
          {label}
        </Text>
        <Text style={[shellStyles.dayChipSub, active && shellStyles.dayChipSubActive]}>
          {sub.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const shellStyles = StyleSheet.create({
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
    letterSpacing: tracking.wider,
  },
  pillTextActive: { color: colors.dark },
  sectionLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
    marginBottom: spacing.lg,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    backgroundColor: colors.dark,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    backgroundColor: colors.dark,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing.lg,
  },
  upcomingWhen: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wide,
  },
  upcomingSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: 2,
  },
  dayChipRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  dayChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.dark,
  },
  dayChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayChipText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wide,
  },
  dayChipTextActive: { color: colors.dark },
  dayChipSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
  },
  dayChipSubActive: { color: colors.dark },
});
