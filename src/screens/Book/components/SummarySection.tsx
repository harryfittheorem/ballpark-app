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
import { uuidv4 } from '@/utils/uuid';
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
  /** Called after a BAF booking error so the parent can scroll the error into view */
  onBafError?: () => void;
};

/** Extract a human-readable message from any thrown value */
function extractMessage(err: unknown): string {
  if (err === null || err === undefined) return 'Something went wrong.';
  if (typeof err === 'string') return err.trim() || 'Something went wrong.';
  if (typeof err === 'object') {
    console.error('[BAF] bookSessionWithFriend error:', JSON.stringify(err));
    const o = err as Record<string, unknown>;
    const pick = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    return pick(o.message) || pick(o.details) || pick(o.hint) || pick(o.code) || 'Something went wrong.';
  }
  return 'Something went wrong.';
}

const BAF_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMsg)), ms),
    ),
  ]);
}

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
  onBafError,
}: Props) {
  const { family, kid: defaultKid, kids } = useSelectedKid();
  const location = useActiveLocation();
  const coaches = useCoaches();
  const createBooking = useCreateBooking();
  const { data: membership, weeklyRemaining, weeklyTotal } = useActiveMembership();
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

  // ── Membership-aware credit state ─────────────────────────────────────────
  const hasMembership = !!membership;
  const isFreeSession = sessionType?.base_price_cents === 0;

  // OTC pack
  const isOtcPack =
    membership?.plan_type === 'otc' &&
    membership.sessions_remaining !== null &&
    membership.sessions_total !== null;
  const otcRemaining = isOtcPack ? (membership!.sessions_remaining as number) : null;
  const otcTotal     = isOtcPack ? (membership!.sessions_total as number) : null;

  // EFT limited (has sessions_per_week)
  const isEftLimited = membership?.plan_type === 'eft' && weeklyTotal !== null;

  // Out of credits check — covers both OTC and EFT limited
  const outOfCredits =
    (otcRemaining !== null && otcRemaining === 0) ||
    (isEftLimited && weeklyRemaining !== null && weeklyRemaining === 0);

  // Price label for solo booking
  const priceLabel = useMemo((): string | null => {
    if (!sessionType) return null;
    if (isFreeSession) return 'Free';
    // Members: show credit label instead of dollar
    if (hasMembership) return '1 credit';
    return formatPriceUSD(sessionType.base_price_cents);
  }, [sessionType, hasMembership, isFreeSession]);

  // Price label when BAF is opted in
  const bafPriceLabel = useMemo((): string | null => {
    if (!sessionType) return null;
    if (isFreeSession) return 'Free';
    if (hasMembership) return '2 credits';
    return `${formatPriceUSD(sessionType.base_price_cents)} × 2 sessions`;
  }, [sessionType, hasMembership, isFreeSession]);

  /**
   * Bring-a-Friend eligibility:
   * - Member has >= 2 sessions available (or unlimited EFT)
   * - Slot has >= 2 remaining spots
   */
  const bafEligible = useMemo((): boolean => {
    if (slotIsFull) return false;
    if (slotRemainingSpots !== null && slotRemainingSpots < 2) return false;
    // OTC: need >= 2 remaining
    if (otcRemaining !== null && otcRemaining < 2) return false;
    // EFT limited: need >= 2 weekly remaining
    if (isEftLimited && weeklyRemaining !== null && weeklyRemaining < 2) return false;
    return true;
  }, [slotIsFull, slotRemainingSpots, otcRemaining, isEftLimited, weeklyRemaining]);

  // Credits preview after booking (used in OTC "After booking" row)
  const creditsAfterPrimary = otcRemaining !== null ? Math.max(0, otcRemaining - 1) : null;
  const creditsAfterBaf     = otcRemaining !== null ? Math.max(0, otcRemaining - 2) : null;
  const creditsDisplayAfter = bafOptedIn ? creditsAfterBaf : creditsAfterPrimary;

  // Weekly credits after booking (EFT limited preview)
  const weeklyAfterPrimary = weeklyRemaining !== null ? Math.max(0, weeklyRemaining - 1) : null;
  const weeklyAfterBaf     = weeklyRemaining !== null ? Math.max(0, weeklyRemaining - 2) : null;
  const weeklyDisplayAfter = bafOptedIn ? weeklyAfterBaf : weeklyAfterPrimary;

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
  const friendRequest = useRef<{ payload: string; id: string } | null>(null);

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

    // ── BAF path ─────────────────────────────────────────────────────────────
    if (bafOptedIn) {
      setBafPending(true);
      try {
        const payload = JSON.stringify([activeKid.id, slot, bafName, bafPhone, bafEmail]);
        if (friendRequest.current?.payload !== payload) friendRequest.current = { payload, id: uuidv4() };
        const result = await withTimeout(
          bookSessionWithFriend({
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
            request_id:       friendRequest.current.id,
          }),
          BAF_TIMEOUT_MS,
          'Unable to complete booking — please try again.',
        );
        setBafResult(result);
        void qc.invalidateQueries({ queryKey: ['day_bookings'] });
        void qc.invalidateQueries({ queryKey: ['upcoming-session'] });
        void qc.invalidateQueries({ queryKey: ['family_bookings'] });
        void qc.invalidateQueries({ queryKey: activeMembershipKey(activeKid.id) });
        void qc.invalidateQueries({ queryKey: ['family'] });
        void qc.invalidateQueries({ queryKey: ['points_ledger'] });
      } catch (err) {
        const msg = extractMessage(err);
        setBafBookingError(
          msg.includes('no_session_credits')
            ? 'Not enough credits for Bring-a-Friend (need 2).'
            : msg,
        );
        onBafError?.();
      } finally {
        setBafPending(false);
      }
      return;
    }

    // ── Normal path ──────────────────────────────────────────────────────────
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

  // Post-booking success — BAF path
  if (bafResult !== null) {
    const otcBalanceAfter = bafResult.sessions_remaining;
    const weeklyBalanceAfter = bafResult.weekly_sessions_remaining;
    const showOtcBalance  = isOtcPack && otcBalanceAfter >= 0;
    const showEftBalance  = isEftLimited && weeklyBalanceAfter >= 0 && weeklyTotal !== null;
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
          {showOtcBalance ? (
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Credits remaining</Text>
              <Text style={styles.balanceNumber}>{otcBalanceAfter}</Text>
              <Text style={styles.balanceOf}>of {otcTotal}</Text>
            </View>
          ) : null}
          {showEftBalance ? (
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Credits this week</Text>
              <Text style={styles.balanceNumber}>{weeklyBalanceAfter}</Text>
              <Text style={styles.balanceOf}>of {weeklyTotal} remaining</Text>
            </View>
          ) : null}
          <Button label="Done" onPress={handleDone} variant="primary" />
        </View>
      </SectionCard>
    );
  }

  // Post-booking success — normal path
  if (bookingResult !== null) {
    const otcBalanceAfter    = bookingResult.sessionsRemaining;
    const showOtcBalance     = isOtcPack && otcBalanceAfter >= 0;
    // weeklyRemaining from the hook already reflects the latest DB state after
    // invalidation; show it if this is an EFT limited membership.
    const showEftBalance     = isEftLimited && weeklyTotal !== null;
    return (
      <SectionCard title="Summary" locked={false}>
        <View style={styles.confirmedBlock}>
          <Text style={styles.confirmedTitle}>Session booked!</Text>
          <Text style={styles.confirmedWhen}>{formattedWhenRef.current}</Text>
          <Text style={styles.confirmedProvider}>Infinite Hitting</Text>
          {showOtcBalance ? (
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Credits remaining</Text>
              <Text style={styles.balanceNumber}>{otcBalanceAfter}</Text>
              <Text style={styles.balanceOf}>of {otcTotal}</Text>
            </View>
          ) : null}
          {showEftBalance ? (
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Credits this week</Text>
              <Text style={styles.balanceNumber}>{weeklyRemaining ?? '—'}</Text>
              <Text style={styles.balanceOf}>of {weeklyTotal} remaining</Text>
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
                valueStyle={hasMembership && !isFreeSession ? styles.lineValueGold : undefined}
              />
            ) : (
              <SummaryLine label="Status" value="Session Full — Waitlist" />
            )}

            {/* Kid selector — only shown when family has multiple kids */}
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

            {/* OTC pack balance preview */}
            {!slotIsFull && isOtcPack && otcRemaining !== null && otcTotal !== null ? (
              <SummaryLine
                label="After booking"
                value={
                  outOfCredits
                    ? 'No credits remaining'
                    : `${creditsDisplayAfter as number} of ${otcTotal} remaining`
                }
                valueStyle={outOfCredits ? styles.lineValueDanger : styles.lineValueGold}
              />
            ) : null}

            {/* EFT limited: weekly credit indicator */}
            {!slotIsFull && isEftLimited && weeklyRemaining !== null && weeklyTotal !== null ? (
              <SummaryLine
                label="This week"
                value={
                  outOfCredits
                    ? 'No credits remaining this week'
                    : `${weeklyDisplayAfter as number} of ${weeklyTotal} remaining${bafOptedIn ? ' after' : ''}`
                }
                valueStyle={outOfCredits ? styles.lineValueDanger : styles.lineValueGold}
              />
            ) : null}

            {/* Bring-a-Friend */}
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
                    {sessionType?.type_category === 'cage' && <Text style={styles.bafToggleSub}>
                      Requires two available rental cages.
                    </Text>}
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
                      {isEftLimited
                        ? 'You\'ve used all your credits for this week. Come back Monday!'
                        : 'You\'ve used all your session credits. Contact the front desk to add more.'}
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
                      {isEftLimited
                        ? 'You\'ve used all your credits for this week. Come back Monday!'
                        : 'You\'ve used all your session credits. Contact the front desk to add more.'}
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
