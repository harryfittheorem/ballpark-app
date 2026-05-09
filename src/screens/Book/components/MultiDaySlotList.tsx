import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import { useCoachAvailability } from '../hooks/useCoachAvailability';
import { useCoaches } from '../hooks/useCoaches';
import { useDayBookings } from '../hooks/useDayBookings';
import { usePrimaryLocation } from '../hooks/usePrimaryLocation';
import { formatSlotTime, generateDaySlots, type Slot, type AvailabilityForSlots } from '../utils/slots';
import type { SessionType } from '@/api/bookings';
import type { Coach } from '@/api/bookings';

type Category = 'all' | 'private' | 'group' | 'cage';

type Props = {
  sessionType: SessionType | null;
  category: Category;
  onPickSlot: (date: string, slot: Slot) => void;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getDayLabel(date: string, index: number): string {
  if (index === 0) return 'TODAY';
  if (index === 1) return 'TOMORROW';
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}

function getFullDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getTypeBadge(category: Category, sessionType: SessionType | null): string {
  if (category !== 'all') return category.toUpperCase();
  const cat = sessionType?.type_category ?? 'private';
  if (cat === 'group') return 'GROUP';
  if (cat === 'cage') return 'CAGE';
  return 'PRIVATE';
}

function DayGroup({
  date,
  dayLabel,
  fullDate,
  sessionType,
  category,
  availability,
  coaches,
  locationName,
  timezone,
  onPickSlot,
}: {
  date: string;
  dayLabel: string;
  fullDate: string;
  sessionType: SessionType;
  category: Category;
  availability: AvailabilityForSlots[] | undefined;
  coaches: Coach[] | undefined;
  locationName: string | null;
  timezone: string | null;
  onPickSlot: (slot: Slot) => void;
}) {
  const bookings = useDayBookings(date, timezone);
  const isPending = bookings.isPending || !availability;

  const slots =
    !isPending && availability && bookings.data
      ? generateDaySlots({
          date,
          durationMinutes: sessionType.duration_minutes,
          timezone,
          availability,
          bookings: bookings.data,
        })
      : [];

  const coachNameOf = (id: string) => {
    const c = coaches?.find((x) => x.id === id);
    return c ? `${c.first_name} ${c.last_name}`.trim() : 'Coach';
  };

  const typeBadge = getTypeBadge(category, sessionType);
  const openCount = slots.length;

  return (
    <View style={styles.dayGroup}>
      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <Text style={styles.dayName}>{dayLabel}</Text>
          <Text style={styles.dayDate}>{fullDate}</Text>
        </View>
        {isPending ? (
          <ActivityIndicator size="small" color={colors.gold} />
        ) : (
          <View style={styles.openCountBadge}>
            <Text style={styles.openCountText}>{openCount} OPEN</Text>
          </View>
        )}
      </View>

      {!isPending && slots.length === 0 ? (
        <View style={styles.noSlots}>
          <Text style={styles.noSlotsText}>No open slots {dayLabel.toLowerCase()}.</Text>
        </View>
      ) : (
        slots.map((slot) => (
          <Pressable
            key={`${slot.coach_id}|${slot.start}`}
            onPress={() => onPickSlot(slot)}
            style={({ pressed }) => [styles.slotRow, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Text style={styles.slotTime}>{formatSlotTime(slot.start, timezone)}</Text>
            <View style={styles.slotMiddle}>
              <Text style={styles.slotCoach}>{coachNameOf(slot.coach_id)}</Text>
              {locationName ? (
                <Text style={styles.slotMeta}>{locationName}</Text>
              ) : null}
            </View>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeBadge}</Text>
            </View>
            <ChevronRight size={14} color={colors.textLight} />
          </Pressable>
        ))
      )}
    </View>
  );
}

export default function MultiDaySlotList({ sessionType, category, onPickSlot }: Props) {
  const availability = useCoachAvailability();
  const location = usePrimaryLocation();
  const coaches = useCoaches();

  const timezone = location.data?.timezone ?? null;
  const locationName = location.data?.name ?? null;

  const today = new Date();
  const days = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    return ymd(d);
  });

  if (!sessionType) {
    return (
      <View style={styles.noTypeHint}>
        <Text style={styles.noTypeText}>
          Pick a session type above to see open slots.
        </Text>
      </View>
    );
  }

  return (
    <View>
      {days.map((date, i) => (
        <DayGroup
          key={date}
          date={date}
          dayLabel={getDayLabel(date, i)}
          fullDate={getFullDate(date)}
          sessionType={sessionType}
          category={category}
          availability={availability.data}
          coaches={coaches.data}
          locationName={locationName}
          timezone={timezone}
          onPickSlot={(slot) => onPickSlot(date, slot)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  noTypeHint: {
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noTypeText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    textAlign: 'center',
  },
  dayGroup: {
    marginBottom: spacing['2xl'],
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.base,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wider,
  },
  dayDate: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    marginTop: 2,
  },
  openCountBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(241,229,173,0.12)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  openCountText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
  noSlots: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.base,
  },
  noSlotsText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
  },
  slotTime: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    width: 76,
    lineHeight: 26,
  },
  slotMiddle: {
    flex: 1,
  },
  slotCoach: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
  },
  slotMeta: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(241,229,173,0.15)',
  },
  typeBadgeText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
});
