import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Calendar as CalendarIcon, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollView as ScrollViewType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/components/ui';
import { useFamilyBookings } from '@/hooks/useFamilyBookings';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useActiveMembership } from '@/hooks/useActiveMembership';
import type { MainTabScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import BookHeader from './components/BookHeader';
import DateSection from './components/DateSection';
import MultiDaySlotList from './components/MultiDaySlotList';
import SummarySection from './components/SummarySection';
import TimeSection from './components/TimeSection';
import { useSessionTypes } from './hooks/useSessionTypes';
import { useActiveLocation } from './hooks/useActiveLocation';
import { useSlotAvailability } from '@/hooks/useSlotAvailability';
import { styles as flowStyles } from './styles';
import type { Slot } from './utils/slots';
import type { SessionType } from '@/api/bookings';

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
  const summaryY = useRef<number>(0);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [cageMode, setCageMode] = useState(false);

  const [selectedSessionTypeId, setSelectedSessionTypeId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null);

  const { data: sessionTypes } = useSessionTypes();
  const selectedSessionType: SessionType | null =
    sessionTypes?.find((s) => s.id === selectedSessionTypeId) ?? null;

  const { kid } = useSelectedKid();
  const activeLocationData = useActiveLocation();
  const timezone = activeLocationData.data?.timezone ?? null;
  const cageRentalEnabled = (activeLocationData.data as { cage_rental_enabled?: boolean } | null)
    ?.cage_rental_enabled ?? false;

  const { data: membership } = useActiveMembership();
  const sessionsRemaining =
    membership?.sessions_remaining !== undefined && membership?.sessions_remaining !== null
      ? membership.sessions_remaining
      : null;

  // Auto-select the first non-cage session type when types load
  useEffect(() => {
    if (!sessionTypes || sessionTypes.length === 0) return;
    if (selectedSessionTypeId) return;
    const nonCage = sessionTypes.find((s) => s.type_category !== 'cage');
    if (nonCage) {
      setSelectedSessionTypeId(nonCage.id);
    }
  }, [sessionTypes, selectedSessionTypeId]);

  // When cage mode toggles, switch to appropriate session type
  useEffect(() => {
    if (!sessionTypes) return;
    if (cageMode) {
      const cage = sessionTypes.find((s) => s.type_category === 'cage');
      if (cage) {
        setSelectedSessionTypeId(cage.id);
        setSelectedDate(null);
        setSelectedSlot(null);
        setSelectedCoachId(null);
      }
    } else {
      const nonCage = sessionTypes.find((s) => s.type_category !== 'cage');
      if (nonCage) {
        setSelectedSessionTypeId(nonCage.id);
        setSelectedDate(null);
        setSelectedSlot(null);
        setSelectedCoachId(null);
      }
    }
  }, [cageMode, sessionTypes]);

  // Slot availability for the selected date — used for slotIsFull check and BAF
  const slotAvailability = useSlotAvailability(
    selectedDate,
    selectedSessionTypeId,
    selectedSessionType?.type_category ?? null,
    timezone,
  );

  // Canonical slot key for the selected slot
  const selectedWaitlistSlotKey = selectedSlot
    ? `${selectedSlot.coach_id}_${new Date(selectedSlot.start).toISOString().replace(/\.\d{3}Z$/, 'Z')}`
    : null;

  const selectedSlotInfo = selectedWaitlistSlotKey
    ? slotAvailability.data?.get(selectedWaitlistSlotKey)
    : null;

  const slotIsFull =
    !!selectedSlotInfo &&
    selectedSlotInfo.confirmed_count >= selectedSlotInfo.capacity;

  // Remaining spots in the selected slot (used for Bring-a-Friend eligibility)
  const slotRemainingSpots = selectedSlotInfo
    ? Math.max(0, selectedSlotInfo.capacity - selectedSlotInfo.confirmed_count)
    : null;

  const { data: bookings } = useFamilyBookings();
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = useMemo(() => {
    if (!bookings) return [];
    const now = Date.now();
    return bookings
      .filter(
        (b) =>
          b.status !== 'cancelled' &&
          new Date(b.scheduled_start).getTime() >= now &&
          (!kid || b.kid_id === kid.id),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      )
      .slice(0, 3);
  }, [bookings, kid]);

  const handleSelectDate = useCallback((d: string) => {
    setSelectedDate(d);
    setSelectedSlot(null);
    setSelectedCoachId(null);
  }, []);

  const handleSelectSlot = useCallback((slot: Slot, _eligible: string[]) => {
    setSelectedSlot(slot);
    // Always auto-assign coach — names are not shown to the member
    setSelectedCoachId(slot.coach_id);
  }, []);

  const selectedSlotKey = selectedSlot
    ? `${selectedSlot.coach_id}|${selectedSlot.start}`
    : null;

  const scrollToSummary = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: summaryY.current, animated: true });
    }, 80);
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setSelectedCoachId(null);
    setCalendarOpen(false);
  }, []);

  const handleBooked = useCallback(
    (formattedWhen: string) => {
      resetSelection();
      navigation.navigate('Home', { screen: 'HomeMain' });
      showToast(`Session booked for ${formattedWhen}`);
    },
    [navigation, resetSelection, showToast],
  );

  const handleWaitlistJoined = useCallback(
    (position: number) => {
      showToast(`You're #${position} on the waitlist!`);
    },
    [showToast],
  );

  const handleMultiDaySlotPick = useCallback(
    (date: string, slot: Slot) => {
      handleSelectDate(date);
      handleSelectSlot(slot, [slot.coach_id]);
      scrollToSummary();
    },
    [handleSelectDate, handleSelectSlot, scrollToSummary],
  );

  const handleCalendarSlotPick = useCallback(
    (slot: Slot, eligible: string[]) => {
      handleSelectSlot(slot, eligible);
      setCalendarOpen(false);
      scrollToSummary();
    },
    [handleSelectSlot, scrollToSummary],
  );

  const summaryLocked =
    !selectedSessionTypeId || !selectedDate || !selectedSlot || !selectedCoachId;

  const creditsLabel =
    sessionsRemaining !== null
      ? `${sessionsRemaining} lesson${sessionsRemaining === 1 ? '' : 's'} remaining`
      : null;

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
        {/* YOUR UPCOMING --------------------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>YOUR UPCOMING</Text>
          {upcoming.length === 0 ? (
            <View style={shellStyles.emptyCard}>
              <CalendarIcon size={18} color={colors.gold} />
              <Text style={shellStyles.emptyText}>
                No upcoming sessions. Pick one below.
              </Text>
            </View>
          ) : (
            upcoming.map((b) => {
              const start = new Date(b.scheduled_start);
              const badge = dateBadgeLabel(start, today, tomorrow);
              const sc = statusColors(b.status ?? 'pending');
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
                  <View style={shellStyles.dateBadge}>
                    <Text style={shellStyles.dateBadgeTop}>{badge.top}</Text>
                    <Text style={shellStyles.dateBadgeBottom}>{badge.bottom}</Text>
                  </View>
                  <View style={shellStyles.upcomingMiddle}>
                    <Text style={shellStyles.upcomingTitle} numberOfLines={1}>
                      {b.session_type?.name ?? 'Session'}
                    </Text>
                    {locationSub ? (
                      <Text style={shellStyles.upcomingSub} numberOfLines={1}>
                        {locationSub}
                      </Text>
                    ) : null}
                  </View>
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

        {/* Credit balance pill --------------------------------------------- */}
        {creditsLabel ? (
          <View style={shellStyles.creditsBanner}>
            <Text style={shellStyles.creditsText}>{creditsLabel}</Text>
          </View>
        ) : null}

        {/* Cage mode toggle ------------------------------------------------- */}
        {cageRentalEnabled ? (
          <View style={shellStyles.cageToggleRow}>
            <Pressable
              onPress={() => setCageMode(false)}
              style={[shellStyles.cageTab, !cageMode && shellStyles.cageTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: !cageMode }}
            >
              <Text style={[shellStyles.cageTabText, !cageMode && shellStyles.cageTabTextActive]}>
                HITTING LESSONS
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCageMode(true)}
              style={[shellStyles.cageTab, cageMode && shellStyles.cageTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: cageMode }}
            >
              <Text style={[shellStyles.cageTabText, cageMode && shellStyles.cageTabTextActive]}>
                CAGE RENTALS
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* AVAILABLE SLOTS ------------------------------------------------- */}
        <View style={flowStyles.section}>
          <Text style={shellStyles.sectionLabel}>AVAILABLE SLOTS</Text>
          <MultiDaySlotList
            sessionType={selectedSessionType}
            onPickSlot={handleMultiDaySlotPick}
          />
        </View>

        {/* Browse other dates button --------------------------------------- */}
        <View style={flowStyles.section}>
          <Pressable
            onPress={() => {
              if (!selectedSessionTypeId) {
                showToast('Session types still loading — please wait.');
                return;
              }
              setCalendarOpen(true);
            }}
            style={({ pressed }) => [
              shellStyles.browseButton,
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
          >
            <CalendarIcon size={16} color={colors.textLight} />
            <Text style={shellStyles.browseText}>Browse other dates</Text>
          </Pressable>
        </View>

        {/* SUMMARY --------------------------------------------------------- */}
        <View
          style={flowStyles.section}
          onLayout={(e) => {
            summaryY.current = e.nativeEvent.layout.y;
          }}
        >
          <SummarySection
            locked={summaryLocked}
            lockedHint="Tap any slot above to see your booking summary."
            sessionType={selectedSessionType}
            date={selectedDate}
            slot={selectedSlot}
            selectedCoachId={selectedCoachId}
            slotIsFull={slotIsFull}
            slotRemainingSpots={slotRemainingSpots}
            onBooked={handleBooked}
            onWaitlistJoined={handleWaitlistJoined}
          />
        </View>
      </ScrollView>

      {/* Browse other dates — bottom-sheet modal -------------------------- */}
      <Modal
        visible={calendarOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCalendarOpen(false)}
      >
        <View style={shellStyles.modalOverlay}>
          <Pressable
            style={shellStyles.modalBackdrop}
            onPress={() => setCalendarOpen(false)}
          />

          <View style={shellStyles.modalSheet}>
            <View style={shellStyles.modalHandle} />

            <View style={shellStyles.modalHeader}>
              <Text style={shellStyles.modalTitle}>BROWSE DATES</Text>
              <Pressable
                onPress={() => setCalendarOpen(false)}
                style={shellStyles.modalCloseBtn}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={colors.textLight} />
              </Pressable>
            </View>

            <ScrollView
              style={shellStyles.modalScroll}
              contentContainerStyle={shellStyles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <DateSection
                locked={false}
                durationMinutes={selectedSessionType?.duration_minutes ?? null}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
              />
              {selectedDate ? (
                <View style={shellStyles.modalTimeSectionWrap}>
                  <TimeSection
                    locked={false}
                    date={selectedDate}
                    sessionTypeId={selectedSessionTypeId}
                    durationMinutes={selectedSessionType?.duration_minutes ?? null}
                    selectedSlotKey={selectedSlotKey}
                    onSelectSlot={handleCalendarSlotPick}
                  />
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const shellStyles = StyleSheet.create({
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
  creditsBanner: {
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(241, 229, 173, 0.08)',
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
  },
  creditsText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    letterSpacing: tracking.wide,
  },
  cageToggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing['3xl'],
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cageTab: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.darker,
  },
  cageTabActive: {
    backgroundColor: colors.gold,
  },
  cageTabText: {
    color: colors.textLight,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  cageTabTextActive: {
    color: colors.dark,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.darker,
  },
  browseText: {
    flex: 1,
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    height: '80%',
    backgroundColor: colors.darkest,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderGold,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.base,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    flex: 1,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['4xl'],
  },
  modalTimeSectionWrap: {
    marginTop: spacing['2xl'],
  },
});
