import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Calendar } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useFamilyBookings } from '@/hooks/useFamilyBookings';
import type { MainTabScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import BookHeader from './components/BookHeader';
import CoachSection from './components/CoachSection';
import DateSection from './components/DateSection';
import MultiDaySlotList from './components/MultiDaySlotList';
import SessionTypeSection from './components/SessionTypeSection';
import SummarySection from './components/SummarySection';
import TimeSection from './components/TimeSection';
import { useSessionTypes } from './hooks/useSessionTypes';
import { styles as flowStyles } from './styles';
import type { Slot } from './utils/slots';
import type { SessionType } from '@/api/bookings';

type Category = 'all' | 'private' | 'group' | 'cage';

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'private', label: 'PRIVATE LESSONS' },
  { key: 'group', label: 'GROUP CLASSES' },
  { key: 'cage', label: 'CAGE RENTALS' },
];

function statusLabel(status: string): string {
  if (status === 'confirmed') return 'CONFIRMED';
  if (status === 'pending') return 'PENDING';
  return status.toUpperCase();
}

function statusColors(status: string): { bg: string; text: string } {
  if (status === 'confirmed') return { bg: 'rgba(168,198,127,0.18)', text: colors.success };
  if (status === 'pending') return { bg: 'rgba(232,167,71,0.18)', text: colors.warning };
  return { bg: 'rgba(155,149,144,0.18)', text: colors.textLight };
}

function dateBadgeLabel(start: Date, today: Date, tomorrow: Date): { top: string; bottom: string } {
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  let top: string;
  if (isSameDay(start, today)) {
    top = 'TOD';
  } else if (isSameDay(start, tomorrow)) {
    top = 'TMR';
  } else {
    top = start.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase().slice(0, 3);
  }

  const bottom = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { top, bottom };
}

export default function BookScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<MainTabScreenProps<'Book'>['navigation']>();
  const { showToast } = useToast();

  const scrollRef = useRef<ScrollViewType>(null);
  const wizardY = useRef<number>(0);

  const [category, setCategory] = useState<Category>('all');

  const [selectedSessionTypeId, setSelectedSessionTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);
  const [coachAutoSelected, setCoachAutoSelected] = useState(false);
  const [eligibleCoachIds, setEligibleCoachIds] = useState<string[]>([]);

  const { data: sessionTypes } = useSessionTypes();
  const selectedSessionType: SessionType | null =
    sessionTypes?.find((s) => s.id === selectedSessionTypeId) ?? null;

  const { data: bookings } = useFamilyBookings();
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

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

  const handleMultiDaySlotPick = useCallback(
    (date: string, slot: Slot) => {
      if (!selectedSessionTypeId) {
        showToast('Pick a session type first to see open slots.');
        return;
      }
      handleSelectDate(date);
      handleSelectSlot(slot, [slot.coach_id]);
      // Scroll the wizard into view so the parent can confirm without hunting
      // for it. A small delay lets React flush the state update first.
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: wizardY.current, animated: true });
      }, 80);
    },
    [selectedSessionTypeId, handleSelectDate, handleSelectSlot, showToast],
  );

  return (
    <SafeAreaView style={flowStyles.safe} edges={['top']}>
      <BookHeader />
      <ScrollView
        ref={scrollRef}
        style={flowStyles.scroll}
        contentContainerStyle={[
          flowStyles.scrollContent,
          { paddingBottom: tabBarHeight + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter pills ---------------------------------------------------- */}
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
                <Text style={[shellStyles.pillText, active && shellStyles.pillTextActive]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* YOUR UPCOMING --------------------------------------------------- */}
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
              const badge = dateBadgeLabel(start, today, tomorrow);
              const sc = statusColors(b.status ?? 'pending');
              const middle = [
                b.session_type?.name ?? 'Session',
                b.coach ? `with ${b.coach.first_name}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              const locationSub = b.location?.name ?? null;
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
                  {/* Coloured date badge */}
                  <View style={shellStyles.dateBadge}>
                    <Text style={shellStyles.dateBadgeTop}>{badge.top}</Text>
                    <Text style={shellStyles.dateBadgeBottom}>{badge.bottom}</Text>
                  </View>

                  {/* Middle: session name + location */}
                  <View style={shellStyles.upcomingMiddle}>
                    <Text style={shellStyles.upcomingTitle} numberOfLines={1}>
                      {middle}
                    </Text>
                    {locationSub ? (
                      <Text style={shellStyles.upcomingSub} numberOfLines={1}>
                        {locationSub}
                      </Text>
                    ) : null}
                  </View>

                  {/* Status pill */}
                  <View style={[shellStyles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[shellStyles.statusPillText, { color: sc.text }]}>
                      {statusLabel(b.status ?? 'pending')}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        {/* WHAT CAN I BOOK? ----------------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>WHAT CAN I BOOK?</Text>
          <SessionTypeSection
            selectedSessionTypeId={selectedSessionTypeId}
            onSelect={handleSelectSessionType}
            categoryFilter={category}
          />
        </View>

        {/* Multi-day available slots --------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>AVAILABLE SLOTS</Text>
          <MultiDaySlotList
            sessionType={selectedSessionType}
            category={category}
            onPickSlot={handleMultiDaySlotPick}
          />
        </View>

        {/* Wizard ---------------------------------------------------------- */}
        <View
          onLayout={(e) => {
            wizardY.current = e.nativeEvent.layout.y;
          }}
        >
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
        </View>
      </ScrollView>
    </SafeAreaView>
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
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dateBadgeTop: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    letterSpacing: tracking.wide,
    lineHeight: 14,
  },
  dateBadgeBottom: {
    color: colors.dark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    lineHeight: 12,
    marginTop: 2,
  },
  upcomingMiddle: {
    flex: 1,
  },
  upcomingTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
  },
  upcomingSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
});
