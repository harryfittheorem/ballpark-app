import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useFamily } from '@/hooks/useFamily';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

import { useCoaches } from '../hooks/useCoaches';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { usePrimaryLocation } from '../hooks/usePrimaryLocation';
import type { SessionType } from '@/api/bookings';
import type { Slot } from '../utils/slots';
import SectionCard from './SectionCard';

type Props = {
  locked: boolean;
  lockedHint?: string;
  sessionType: SessionType | null;
  date: string | null;
  slot: Slot | null;
  selectedCoachId: string | null;
  onBooked: (formattedWhen: string) => void;
};

function formatPriceUSD(cents: number): string {
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function formatDateLabel(ymd: string, timezone: string | null | undefined): string {
  // Render "Thu, May 14" using the location's timezone. We anchor on noon
  // UTC of the calendar day to avoid offset rollovers near midnight.
  const [y, m, d] = ymd.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(anchor);
  } catch {
    return ymd;
  }
}

function formatTimeLabel(iso: string, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    const dt = new Date(iso);
    return `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }
}

export default function SummarySection({
  locked,
  lockedHint,
  sessionType,
  date,
  slot,
  selectedCoachId,
  onBooked,
}: Props) {
  const { family, kids } = useFamily();
  const location = usePrimaryLocation();
  const coaches = useCoaches();
  const createBooking = useCreateBooking();
  const [errorVisible, setErrorVisible] = useState(false);

  const tz = location.data?.timezone ?? null;
  const coach = useMemo(
    () => coaches.data?.find((c) => c.id === selectedCoachId) ?? null,
    [coaches.data, selectedCoachId],
  );

  // Defensive: if any required input is missing, render the placeholder. The
  // Book screen's gating already prevents this, but Summary stays resilient.
  const ready =
    !locked &&
    !!sessionType &&
    !!date &&
    !!slot &&
    !!coach &&
    !!family &&
    kids.length > 0 &&
    !!location.data;

  const dateLabel = ready ? formatDateLabel(date as string, tz) : null;
  const timeLabel = ready ? formatTimeLabel((slot as Slot).start, tz) : null;
  const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : null;
  const priceLabel = sessionType ? formatPriceUSD(sessionType.base_price_cents) : null;

  const handleConfirm = () => {
    if (!ready || createBooking.isPending) return;
    setErrorVisible(false);

    const kid = kids[0];
    const insert = {
      tenant_id: family!.tenant_id,
      location_id: location.data!.id,
      kid_id: kid.id,
      coach_id: coach!.id,
      session_type_id: sessionType!.id,
      scheduled_start: (slot as Slot).start,
      scheduled_end: (slot as Slot).end,
      status: 'confirmed' as const,
    };

    createBooking.mutate(insert, {
      onSuccess: () => {
        onBooked(`${dateLabel} at ${timeLabel}`);
      },
      onError: () => {
        setErrorVisible(true);
      },
    });
  };

  return (
    <SectionCard
      title="Summary"
      locked={locked}
      lockedHint={locked ? lockedHint : undefined}
    >
      {ready ? (
        <View style={styles.lines}>
          <SummaryLine label="Session" value={sessionType!.name} />
          <SummaryLine label="Date" value={dateLabel as string} />
          <SummaryLine label="Time" value={timeLabel as string} />
          <SummaryLine label="Coach" value={coachName as string} />
          <SummaryLine label="Price" value={priceLabel as string} />
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Your booking summary will appear here.
          </Text>
        </View>
      )}

      <View style={styles.confirmWrap}>
        <Button
          label={createBooking.isPending ? 'Booking…' : 'Confirm Booking'}
          onPress={handleConfirm}
          variant="primary"
          loading={createBooking.isPending}
          disabled={!ready || createBooking.isPending}
        />

        {errorVisible ? (
          <View style={styles.errorBlock}>
            <Text style={styles.errorText}>
              Couldn&apos;t book that session — please try again.
            </Text>
            {__DEV__ && createBooking.error ? (
              <Text style={styles.errorDevText} numberOfLines={3}>
                {createBooking.error.message}
              </Text>
            ) : null}
            <Button
              label="Tap to retry"
              variant="tertiary"
              tone="gold"
              onPress={handleConfirm}
            />
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 80,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  lines: {
    gap: spacing.lg,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing['2xl'],
  },
  lineLabel: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lineValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  confirmWrap: {
    marginTop: spacing['3xl'],
    gap: spacing.lg,
  },
  errorBlock: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.danger,
    textAlign: 'center',
  },
  errorDevText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
  },
});
