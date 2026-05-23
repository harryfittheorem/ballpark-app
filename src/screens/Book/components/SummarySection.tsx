import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import type { Tables } from '@/types/database';

import { useCoaches } from '../hooks/useCoaches';
import { useCreateBooking } from '../hooks/useCreateBooking';
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
  const [errorVisible, setErrorVisible] = useState(false);
  const [kidPickerVisible, setKidPickerVisible] = useState(false);
  const [overrideKidId, setOverrideKidId] = useState<string | null>(null);

  // The kid to book for — parent may override via the picker
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

  const handleConfirm = () => {
    if (!ready || createBooking.isPending || !activeKid) return;
    setErrorVisible(false);

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
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              Tap any slot above — your summary appears here instantly.
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

      {/* Kid picker modal ------------------------------------------------- */}
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
