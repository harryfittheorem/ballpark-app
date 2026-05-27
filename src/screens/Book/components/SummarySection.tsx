import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useActiveMembership } from '@/hooks/useActiveMembership';
import { activeMembershipKey } from '@/hooks/useActiveMembership';
import { useJoinWaitlist } from '@/hooks/useWaitlistEntries';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import type { Tables } from '@/types/database';

import { useCoaches } from '../hooks/useCoaches';
import { useCreateBooking, isNoSessionCreditsError, type CreateBookingResult } from '../hooks/useCreateBooking';
import { useActiveLocation } from '../hooks/useActiveLocation';
import { bookSessionWithFriend, type BookWithFriendResult } from '@/api/memberships';
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
  /** When true the slot is at capacity — show "Join Waitlist" instead of "Confirm Booking" */
  slotIsFull?: boolean;
  /** Number of remaining spots in the selected slot (for Bring-a-Friend eligibility) */
  slotRemainingSpots?: number | null;
  onBooked: (formattedWhen: string) => void;
  onWaitlistJoined?: (position: number) => void;
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
  slotIsFull = false,
  slotRemainingSpots = null,
  onBooked,
  onWaitlistJoined,
}: Props) {
  const { family, kid: defaultKid, kids } = useSelectedKid();
  const location = useActiveLocation();
  const coaches = useCoaches();
  const createBooking = useCreateBooking();
  const { data: membership } = useActiveMembership();
  const joinWaitlist = useJoinWaitlist();

  const qc = useQueryClient();

  const [errorVisible, setErrorVisible] = useState(false);
  const [kidPickerVisible, setKidPickerVisible] = useState(false);
  const [overrideKidId, setOverrideKidId] = useState<string | null>(null);
  const [noCreditsVisible, setNoCreditsVisible] = useState(false);
  const [bookingResult, setBookingResult] = useState<CreateBookingResult | null>(null);
  const [bafResult, setBafResult] = useState<BookWithFriendResult | null>(null);
  const [bafPending, setBafPending] = useState(false);
  const [bafBookingError, setBafBookingError] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);

  // Bring-a-Friend: pre-confirm form state
  const [bafOptedIn, setBafOptedIn] = useState(false);
  const [bafName, setBafName] = useState('');
  const [bafPhone, setBafPhone] = useState('');
  const [bafEmail, setBafEmail] = useState('');
  const [bafError, setBafError] = useState<string | null>(null);

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
  const priceLabel = sessionType ? formatPriceUSD(sessionType.base_price_cents) : null;

  const isOtcPack =
    membership?.plan_type === 'otc' &&
    membership.sessions_remaining !== null &&
    membership.sessions_total !== null;

  const sessionsRemaining = isOtcPack ? (membership!.sessions_remaining as number) : null;
  const sessionsTotal     = isOtcPack ? (membership!.sessions_total as number) : null;

  const outOfCredits = sessionsRemaining !== null && sessionsRemaining === 0;

  /**
   * Bring-a-Friend eligibility (PRE-confirm, uses current balance):
   * - Member has >= 2 sessions available (or unlimited EFT)
   * - Slot has >= 2 remaining spots (room for both bookings)
   */
  const bafEligible =
    !slotIsFull &&
    (slotRemainingSpots === null || slotRemainingSpots >= 2) &&
    (sessionsRemaining === null || sessionsRemaining >= 2);

  // Credits after booking: -1 (primary) -1 (BAF) if opted in, else -1
  const creditsAfterPrimary = sessionsRemaining !== null ? Math.max(0, sessionsRemaining - 1) : null;
  const creditsAfterBaf     = sessionsRemaining !== null ? Math.max(0, sessionsRemaining - 2) : null;
  const creditsDisplayAfter = bafOptedIn ? creditsAfterBaf : creditsAfterPrimary;

  // Price label changes when BAF is opted in (2 sessions instead of 1)
  const bafPriceLabel =
    sessionType ? `${formatPriceUSD(sessionType.base_price_cents)} × 2 sessions` : null;

  useEffect(() => {
    setBookingResult(null);
    setBafResult(null);
    setBafPending(false);
    setBafBookingError(null);
    setErrorVisible(false);
    setNoCreditsVisible(false);
    setBafOptedIn(false);
    setBafName('');
    setBafPhone('');
    setBafEmail('');
    setBafError(null);
    setWaitlistPosition(null);
  }, [slot, date, sessionType?.id, selectedCoachId]);

  const formattedWhenRef = useRef<string>('');

  const handleConfirm = async () => {
    if (!ready || createBooking.isPending || bafPending || !activeKid || outOfCredits) return;
    if (bafOptedIn && !bafName.trim()) {
      setBafError('Friend\'s name is required to add them.');
      return;
    }
    setErrorVisible(false);
    setNoCreditsVisible(false);
    setBookingResult(null);
    setBafResult(null);
    setBafBookingError(null);

    formattedWhenRef.current = `${dateLabel} at ${timeLabel}`;

    // ── BAF path: atomic RPC (deducts 2 credits, creates both bookings, awards points) ──
    if (bafOptedIn) {
      setBafPending(true);
      try {
        const result = await bookSessionWithFriend({
          tenant_id:        family!.tenant_id,
          location_id:      location.data!.id,
          kid_id:           activeKid.id,
          coach_id:         coach!.id,
          session_type_id:  sessionType!.id,
          scheduled_start:  (slot as Slot).start,
          scheduled_end:    (slot as Slot).end,
          guest_name:       bafName.trim(),
          guest_phone:      bafPhone.trim() || null,
          guest_email:      bafEmail.trim() || null,
        });
        setBafResult(result);
        void qc.invalidateQueries({ queryKey: ['day_bookings'] });
        void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
        void qc.invalidateQueries({ queryKey: ['family_bookings'] });
        void qc.invalidateQueries({ queryKey: activeMembershipKey(activeKid.id) });
        void qc.invalidateQueries({ queryKey: ['family'] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setBafBookingError(
          msg.includes('no_session_credits')
            ? 'Not enough credits for Bring-a-Friend (need 2).'
            : msg,
        );
      } finally {
        setBafPending(false);
      }
      return;
    }

    // ── Normal path: useCreateBooking (deducts 1 credit) ─────────────────────
    const insert = {
      tenant_id:       family!.tenant_id,
      location_id:     location.data!.id,
      kid_id:          activeKid.id,
      coach_id:        coach!.id,
      session_type_id: sessionType!.id,
      scheduled_start: (slot as Slot).start,
      scheduled_end:   (slot as Slot).end,
      status:          'confirmed' as const,
    };

    createBooking.mutate(insert, {
      onSuccess: (result) => {
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

  const handleJoinWaitlist = () => {
    if (!ready || joinWaitlist.isPending) return;
    setErrorVisible(false);

    const slotKey = `${(slot as Slot).coach_id}_${new Date((slot as Slot).start).toISOString().replace(/\.\d{3}Z$/, 'Z')}`;

    joinWaitlist.mutate(
      {
        session_slot_key: slotKey,
        coach_id: coach!.id,
        session_type_id: sessionType!.id,
        location_id: location.data!.id,
        scheduled_start: (slot as Slot).start,
        scheduled_end: (slot as Slot).end,
      },
      {
        onSuccess: (entry) => {
          setWaitlistPosition(entry.position);
          onWaitlistJoined?.(entry.position);
        },
        onError: () => {
          setErrorVisible(true);
        },
      },
    );
  };

  // Post-booking success screen — BAF path
  if (bafResult !== null) {
    const balanceAfter = bafResult.sessions_remaining;
    const showBalance  = isOtcPack && balanceAfter >= 0;
    return (
      <SectionCard title="Summary" locked={false}>
        <View style={styles.confirmedBlock}>
          <Text style={styles.confirmedTitle}>Sessions booked!</Text>
          <Text style={styles.confirmedWhen}>{formattedWhenRef.current}</Text>
          <Text style={styles.confirmedProvider}>Infinite Hitting</Text>
          <View style={styles.bafResultBox}>
            <Text style={[styles.bafResultText, styles.bafResultSuccess]}>
              ✓ Friend spot reserved · +100 points earned
            </Text>
          </View>
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

  // Post-booking success screen — normal path
  if (bookingResult !== null) {
    const balanceAfter = bookingResult.sessionsRemaining;
    const showBalance  = isOtcPack && balanceAfter >= 0;
    return (
      <SectionCard title="Summary" locked={false}>
        <View style={styles.confirmedBlock}>
          <Text style={styles.confirmedTitle}>Session booked!</Text>
          <Text style={styles.confirmedWhen}>{formattedWhenRef.current}</Text>
          <Text style={styles.confirmedProvider}>Infinite Hitting</Text>
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
            <SummaryLine label="Provider" value="Infinite Hitting" />
            {!slotIsFull ? (
              <SummaryLine
                label="Price"
                value={bafOptedIn ? (bafPriceLabel as string) : (priceLabel as string)}
                valueStyle={bafOptedIn ? styles.lineValueGold : undefined}
              />
            ) : (
              <SummaryLine label="Status" value="Session Full — Waitlist" />
            )}

            {/* Kid selector row — only shown when family has multiple kids */}
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

            {/* Pack balance preview — updates based on BAF selection */}
            {!slotIsFull && isOtcPack && sessionsRemaining !== null && sessionsTotal !== null ? (
              <SummaryLine
                label="After booking"
                value={
                  outOfCredits
                    ? 'No sessions remaining'
                    : `${creditsDisplayAfter as number} of ${sessionsTotal} remaining`
                }
                valueStyle={outOfCredits ? styles.lineValueDanger : styles.lineValueGold}
              />
            ) : null}

            {/* Bring-a-Friend section — shown pre-confirm when eligible */}
            {bafEligible && !slotIsFull ? (
              <View style={styles.bafSection}>
                <Pressable
                  onPress={() => {
                    setBafOptedIn((v) => !v);
                    setBafError(null);
                  }}
                  style={styles.bafToggleRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: bafOptedIn }}
                >
                  <View style={[styles.bafCheckbox, bafOptedIn && styles.bafCheckboxChecked]}>
                    {bafOptedIn ? (
                      <Text style={styles.bafCheckmark}>✓</Text>
                    ) : null}
                  </View>
                  <View style={styles.bafToggleLabelBlock}>
                    <Text style={styles.bafToggleLabel}>
                      BRING A FRIEND
                    </Text>
                    <Text style={styles.bafToggleSub}>
                      Uses 2 credits total · You earn +100 pts
                    </Text>
                  </View>
                </Pressable>

                {bafOptedIn ? (
                  <View style={styles.bafForm}>
                    <TextInput
                      style={[styles.bafInput, !bafName.trim() && bafError ? styles.bafInputError : null]}
                      placeholder="Friend's name *"
                      placeholderTextColor={colors.textMuted}
                      value={bafName}
                      onChangeText={(v) => {
                        setBafName(v);
                        if (bafError) setBafError(null);
                      }}
                      autoCorrect={false}
                    />
                    <TextInput
                      style={styles.bafInput}
                      placeholder="Phone (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={bafPhone}
                      onChangeText={setBafPhone}
                      keyboardType="phone-pad"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={styles.bafInput}
                      placeholder="Email (optional)"
                      placeholderTextColor={colors.textMuted}
                      value={bafEmail}
                      onChangeText={setBafEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {bafError ? (
                      <Text style={styles.bafErrorText}>{bafError}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Tap any slot above — your summary appears here instantly.
            </Text>
          </View>
        )}

        {/* Waitlist success state */}
        {waitlistPosition !== null ? (
          <View style={styles.waitlistSuccess}>
            <Text style={styles.waitlistSuccessTitle}>
              ✓ You&apos;re #{waitlistPosition} on the waitlist
            </Text>
            <Text style={styles.waitlistSuccessBody}>
              We&apos;ll notify you if a spot opens. You can leave the waitlist from Me → Bookings.
            </Text>
          </View>
        ) : (
          <View style={styles.confirmWrap}>
            {slotIsFull ? (
              <>
                <Button
                  label={joinWaitlist.isPending ? 'Joining Waitlist…' : 'Join Waitlist'}
                  onPress={handleJoinWaitlist}
                  variant="primary"
                  loading={joinWaitlist.isPending}
                  disabled={!ready || joinWaitlist.isPending}
                />
                {errorVisible ? (
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorText}>
                      Couldn&apos;t join the waitlist — please try again.
                    </Text>
                    <Button
                      label="Tap to retry"
                      variant="tertiary"
                      tone="gold"
                      onPress={handleJoinWaitlist}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {outOfCredits && ready ? (
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorText}>
                      You&apos;ve used all your sessions. Contact the front desk to add more.
                    </Text>
                  </View>
                ) : null}

                <Button
                  label={
                    bafPending ? 'Booking…' :
                    createBooking.isPending ? 'Booking…' :
                    'Confirm Booking'
                  }
                  onPress={() => { void handleConfirm(); }}
                  variant="primary"
                  loading={createBooking.isPending || bafPending}
                  disabled={!ready || createBooking.isPending || bafPending || outOfCredits}
                />

                {noCreditsVisible ? (
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorText}>
                      You&apos;ve used all your sessions. Contact the front desk to add more.
                    </Text>
                  </View>
                ) : null}

                {bafBookingError ? (
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorText}>{bafBookingError}</Text>
                    <Button
                      label="Tap to retry"
                      variant="tertiary"
                      tone="gold"
                      onPress={() => { void handleConfirm(); }}
                    />
                  </View>
                ) : null}

                {errorVisible ? (
                  <View style={styles.errorBlock}>
                    <Text style={styles.errorText}>
                      Couldn&apos;t book that session — please try again.
                    </Text>
                    <Button
                      label="Tap to retry"
                      variant="tertiary"
                      tone="gold"
                      onPress={() => { void handleConfirm(); }}
                    />
                  </View>
                ) : null}
              </>
            )}
          </View>
        )}
      </SectionCard>

      {/* Kid picker modal */}
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
  lineValueGold: {
    color: colors.gold,
  },
  lineValueDanger: {
    color: colors.danger,
  },
  // Bring-a-Friend (pre-confirm)
  bafSection: {
    marginTop: spacing.base,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: 'rgba(241, 229, 173, 0.04)',
    overflow: 'hidden',
  },
  bafToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing['2xl'],
  },
  bafCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.borderGold,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bafCheckboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  bafCheckmark: {
    color: colors.dark,
    fontFamily: fontFamilies.interBold,
    fontSize: 12,
    lineHeight: 14,
  },
  bafToggleLabelBlock: {
    flex: 1,
  },
  bafToggleLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    letterSpacing: tracking.wide,
  },
  bafToggleSub: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: 1,
  },
  bafForm: {
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
    gap: spacing.base,
  },
  bafInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    backgroundColor: colors.darker,
  },
  bafInputError: {
    borderColor: colors.danger,
  },
  bafErrorText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.danger,
  },
  confirmWrap: {
    marginTop: spacing['3xl'],
    gap: spacing.lg,
  },
  waitlistSuccess: {
    marginTop: spacing['3xl'],
    padding: spacing['2xl'],
    backgroundColor: 'rgba(168,198,127,0.12)',
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    gap: spacing.sm,
  },
  waitlistSuccessTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.success,
  },
  waitlistSuccessBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
    lineHeight: 20,
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
  // Post-booking success state
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
  confirmedProvider: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  bafResultBox: {
    width: '100%',
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
    alignItems: 'center',
  },
  bafResultText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.textLight,
    textAlign: 'center',
  },
  bafResultSuccess: {
    color: colors.success,
  },
  bafResultError: {
    color: colors.danger,
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
  // Kid picker modal
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
});
