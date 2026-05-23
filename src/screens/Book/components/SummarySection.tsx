import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useActiveMembership } from '@/hooks/useActiveMembership';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import type { Tables } from '@/types/database';

import { useCoaches } from '../hooks/useCoaches';
import { useCreateBooking, isNoSessionCreditsError, type CreateBookingResult } from '../hooks/useCreateBooking';
import { useActiveLocation } from '../hooks/useActiveLocation';
import type { SessionType } from '@/api/bookings';
import type { Slot } from '../utils/slots';
import SectionCard from './SectionCard';

type Kid = Tables<'kids'>;

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
  const { family, kid: defaultKid, kids } = useSelectedKid();
  const location = useActiveLocation();
  const coaches = useCoaches();
  const createBooking = useCreateBooking();
  const { data: membership } = useActiveMembership();

  const [errorVisible, setErrorVisible] = useState(false);
  // Task #242: sibling / kid-picker
  const [kidPickerVisible, setKidPickerVisible] = useState(false);
  const [overrideKidId, setOverrideKidId] = useState<string | null>(null);
  // Task #237: session credit gating
  const [noCreditsVisible, setNoCreditsVisible] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingResult | null>(null);

  // The kid to book for — parent may override via the picker (Task #242)
  const activeKid: Kid | null = useMemo(() => {
    if (overrideKidId) {
      return kids.find((k) => k.id === overrideKidId) ?? defaultKid;
    }
    return defaultKid;
  }, [overrideKidId, kids, defaultKid]);

  const multipleKids = kids.length > 1;

  const tz = location.data?.timezone ?? null;
  const coach = useMemo(
    () => coaches.data?.find((c) => c.id === selectedCoachId) ?? null,
    [coaches.data, selectedCoachId],
  );

  const ready =
    !locked &&
    !!sessionType &&
    !!date &&
    !!slot &&
    !!coach &&
    !!family &&
    !!activeKid &&
    !!location.data;

  const dateLabel = ready ? formatDateLabel(date as string, tz) : null;
  const timeLabel = ready ? formatTimeLabel((slot as Slot).start, tz) : null;
  const coachName = coach ? `${coach.first_name} ${coach.last_name}`.trim() : null;
  const priceLabel = sessionType ? formatPriceUSD(sessionType.base_price_cents) : null;

  // Session credits for OTC pack holders (Task #237)
  const isOtcPack =
    membership?.plan_type === 'otc' &&
    membership.sessions_remaining !== null &&
    membership.sessions_total !== null;

  const sessionsRemaining = isOtcPack ? (membership!.sessions_remaining as number) : null;
  const sessionsTotal     = isOtcPack ? (membership!.sessions_total as number) : null;

  // The balance AFTER this booking (pre-confirmation hint to user)
  const sessionsAfter =
    sessionsRemaining !== null ? Math.max(0, sessionsRemaining - 1) : null;

  // Already out of credits — disable confirm proactively
  const outOfCredits = sessionsRemaining !== null && sessionsRemaining === 0;

  // Stores the formatted when string so the Done button can pass it to onBooked
  const formattedWhenRef = useRef<string>('');

  const handleConfirm = () => {
    // Both guards: kid must be selected (Task #242) AND credits must be available (Task #237)
    if (!ready || createBooking.isPending || !activeKid || outOfCredits) return;
    setErrorVisible(false);
    setNoCreditsVisible(false);
    setBookingResult(null);

    const insert = {
      tenant_id: family!.tenant_id,
      location_id: location.data!.id,
      kid_id: activeKid.id,
      coach_id: coach!.id,
      session_type_id: sessionType!.id,
      scheduled_start: (slot as Slot).start,
      scheduled_end: (slot as Slot).end,
      status: 'confirmed' as const,
    };

    formattedWhenRef.current = `${dateLabel} at ${timeLabel}`;

    createBooking.mutate(insert, {
      onSuccess: (result) => {
        // Task #237: hold here so the user can see their updated pack balance
        // before navigating away. The "Done" button calls onBooked.
        setBookingResult(result);
      },
      onError: (err) => {
        if (isNoSessionCreditsError(err)) {
          setNoCreditsVisible(true);
        } else {
          setErrorVisible(true);
        }
      },
    });
  };

  const handleDone = () => {
    onBooked(formattedWhenRef.current);
  };

  // Task #237: confirmed state — show balance before navigating
  if (bookingResult !== null) {
    const balanceAfter = bookingResult.sessionsRemaining;
    const showBalance  = isOtcPack && balanceAfter >= 0;

    return (
      <SectionCard title="Summary" locked={false}>
        <View style={styles.confirmedBlock}>
          <Text style={styles.confirmedTitle}>Session booked!</Text>
          <Text style={styles.confirmedWhen}>{formattedWhenRef.current}</Text>

          {showBalance ? (
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Sessions remaining</Text>
              <Text style={styles.balanceNumber}>{balanceAfter}</Text>
              <Text style={styles.balanceOf}>of {sessionsTotal}</Text>
            </View>
          ) : null}

          <Button label="Done" onPress={handleDone} variant="primary" />
        </View>
      </SectionCard>
    );
  }

  return (
    <>
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

            {/* Kid selector row (Task #242) — only shown when family has multiple kids */}
            {multipleKids ? (
              <View style={styles.kidRow}>
                <Text style={styles.lineLabel}>BOOKING FOR</Text>
                <Pressable
                  onPress={() => setKidPickerVisible(true)}
                  style={({ pressed }) => [styles.kidPill, pressed && { opacity: 0.75 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Booking for ${activeKid?.first_name ?? ''}. Tap to change.`}
                >
                  <Text style={styles.kidPillName}>
                    {activeKid?.first_name ?? '—'}
                  </Text>
                  <Text style={styles.kidPillChange}>Change</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Pack balance line (Task #237) */}
            {isOtcPack && sessionsRemaining !== null && sessionsTotal !== null ? (
              <SummaryLine
                label="Pack balance"
                value={
                  outOfCredits
                    ? 'No sessions remaining'
                    : `${sessionsAfter} of ${sessionsTotal} after booking`
                }
                valueStyle={outOfCredits ? styles.lineValueDanger : styles.lineValueGold}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Tap any slot above — your summary appears here instantly.
            </Text>
          </View>
        )}

        <View style={styles.confirmWrap}>
          {/* Out-of-credits warning (Task #237) — shown proactively before the user taps */}
          {outOfCredits && ready ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>
                You&apos;ve used all your sessions. Contact the front desk to add more.
              </Text>
            </View>
          ) : null}

          <Button
            label={createBooking.isPending ? 'Booking…' : 'Confirm Booking'}
            onPress={handleConfirm}
            variant="primary"
            loading={createBooking.isPending}
            disabled={!ready || createBooking.isPending || outOfCredits}
          />

          {/* NO_SESSION_CREDITS race-condition error (Task #237) */}
          {noCreditsVisible ? (
            <View style={styles.errorBlock}>
              <Text style={styles.errorText}>
                You&apos;ve used all your sessions. Contact the front desk to add more.
              </Text>
            </View>
          ) : null}

          {/* Generic error with retry (Task #242/HEAD) */}
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

      {/* Kid picker modal (Task #242) */}
      <Modal
        visible={kidPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setKidPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setKidPickerVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>BOOKING FOR</Text>
            <View style={styles.modalKids}>
              {kids.map((k) => {
                const isActive = k.id === (activeKid?.id ?? null);
                return (
                  <Pressable
                    key={k.id}
                    onPress={() => {
                      setOverrideKidId(k.id);
                      setKidPickerVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.modalKidRow,
                      isActive && styles.modalKidRowActive,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                  >
                    <Text
                      style={[
                        styles.modalKidName,
                        isActive && styles.modalKidNameActive,
                      ]}
                    >
                      {`${k.first_name} ${k.last_name ?? ''}`.trim()}
                    </Text>
                    {isActive ? (
                      <Text style={styles.modalKidCheck}>✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SummaryLine({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, valueStyle]} numberOfLines={2}>
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
  // Task #242: kid-picker
  kidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing['2xl'],
  },
  kidPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(232,167,71,0.12)',
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  kidPillName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.base,
    color: colors.gold,
  },
  kidPillChange: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    color: colors.textLight,
    textDecorationLine: 'underline',
  },
  // Task #237: pack balance line colours
  lineValueGold: {
    color: colors.gold,
  },
  lineValueDanger: {
    color: colors.danger,
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
  // Task #242: kid picker modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    backgroundColor: colors.darker,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderGold,
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing['2xl'],
  },
  modalTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    color: colors.gold,
    letterSpacing: tracking.wider,
    marginBottom: spacing['2xl'],
  },
  modalKids: {
    gap: spacing.lg,
  },
  modalKidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing['2xl'],
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.dark,
  },
  modalKidRowActive: {
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(232,167,71,0.08)',
  },
  modalKidName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  modalKidNameActive: {
    color: colors.gold,
  },
  modalKidCheck: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
  },
  // Task #237: confirmed state (shown after booking succeeds, before navigating)
  confirmedBlock: {
    gap: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  confirmedTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  confirmedWhen: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
  balanceBox: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    backgroundColor: colors.darker,
    borderRadius: 12,
  },
  balanceLabel: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceNumber: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    color: colors.gold,
  },
  balanceOf: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
});
