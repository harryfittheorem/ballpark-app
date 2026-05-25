import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, PauseCircle } from 'lucide-react-native';

import { useMembership } from '@/hooks/useMembership';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = MeStackScreenProps<'PauseMembership'>;

const MIN_DAYS = 7;
const MAX_DAYS = 90;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateDisplay(isoDate: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(isoDate + 'T00:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function clampDays(n: number): number {
  return Math.max(MIN_DAYS, Math.min(MAX_DAYS, n));
}

const QUICK_OPTIONS = [
  { label: '1 week',   days: 7  },
  { label: '2 weeks',  days: 14 },
  { label: '1 month',  days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
];

export default function PauseMembershipScreen({ navigation }: Props) {
  const { membership, loading, pause } = useMembership();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Controlled number of days from today (7–90)
  const [days, setDays] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const selectedDate = useMemo(() => addDays(today, days), [today, days]);
  const selectedStr  = toDateStr(selectedDate);

  const adjustDays = useCallback((delta: number) => {
    setDays(prev => clampDays(prev + delta));
  }, []);

  const handleConfirm = useCallback(() => {
    const pauseEndStr = toDateStr(selectedDate);
    const startStr    = formatDateDisplay(toDateStr(today));
    const endStr      = formatDateDisplay(pauseEndStr);

    Alert.alert(
      'Confirm Pause',
      `No charges from ${startStr} to ${endStr}.\n\nYour membership will automatically resume on ${endStr}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pause Membership',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            try {
              await pause(pauseEndStr);
              Alert.alert(
                'Membership Paused',
                `Your membership is paused until ${endStr}. You can resume early from your profile.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } catch (err) {
              Alert.alert('Could not pause membership', errorMessage(err));
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  }, [selectedDate, today, pause, navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading membership…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!membership || membership.plan_type !== 'eft') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Membership pausing is only available for monthly EFT plans.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const todayStr = toDateStr(today);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <PauseCircle size={32} color={colors.gold} />
          </View>
          <Text style={styles.title}>Pause Membership</Text>
          <Text style={styles.subtitle}>
            Pause your billing while you travel, recover, or take a break.
            No charges during the pause window.
          </Text>
        </View>

        {/* Plan info */}
        <View style={styles.planCard}>
          <Text style={styles.planLabel}>CURRENT PLAN</Text>
          <Text style={styles.planName}>{membership.plan_name}</Text>
          <Text style={styles.planAmount}>
            ${(membership.amount_cents / 100).toFixed(2)}/mo
          </Text>
        </View>

        {/* ── Date Picker ── */}
        <Text style={styles.sectionLabel}>CHOOSE RETURN DATE</Text>

        {/* Day stepper */}
        <View style={styles.stepperCard}>
          <Text style={styles.stepperCaption}>Days from today</Text>

          <View style={styles.stepperRow}>
            {/* -7 */}
            <TouchableOpacity
              style={[styles.stepBtn, days <= MIN_DAYS && styles.stepBtnDisabled]}
              onPress={() => adjustDays(-7)}
              disabled={days <= MIN_DAYS}
            >
              <ChevronLeft size={14} color={days <= MIN_DAYS ? colors.textMuted : colors.textLight} />
              <ChevronLeft size={14} color={days <= MIN_DAYS ? colors.textMuted : colors.textLight} style={{ marginLeft: -8 }} />
            </TouchableOpacity>

            {/* -1 */}
            <TouchableOpacity
              style={[styles.stepBtn, days <= MIN_DAYS && styles.stepBtnDisabled]}
              onPress={() => adjustDays(-1)}
              disabled={days <= MIN_DAYS}
            >
              <ChevronLeft size={18} color={days <= MIN_DAYS ? colors.textMuted : colors.textLight} />
            </TouchableOpacity>

            {/* Day count display */}
            <View style={styles.dayDisplay}>
              <Text style={styles.dayNumber}>{days}</Text>
              <Text style={styles.dayLabel}>days</Text>
            </View>

            {/* +1 */}
            <TouchableOpacity
              style={[styles.stepBtn, days >= MAX_DAYS && styles.stepBtnDisabled]}
              onPress={() => adjustDays(1)}
              disabled={days >= MAX_DAYS}
            >
              <ChevronRight size={18} color={days >= MAX_DAYS ? colors.textMuted : colors.textLight} />
            </TouchableOpacity>

            {/* +7 */}
            <TouchableOpacity
              style={[styles.stepBtn, days >= MAX_DAYS && styles.stepBtnDisabled]}
              onPress={() => adjustDays(7)}
              disabled={days >= MAX_DAYS}
            >
              <ChevronRight size={14} color={days >= MAX_DAYS ? colors.textMuted : colors.textLight} />
              <ChevronRight size={14} color={days >= MAX_DAYS ? colors.textMuted : colors.textLight} style={{ marginLeft: -8 }} />
            </TouchableOpacity>
          </View>

          {/* Range bar */}
          <View style={styles.rangeBar}>
            <View style={[
              styles.rangeFill,
              { width: `${((days - MIN_DAYS) / (MAX_DAYS - MIN_DAYS)) * 100}%` },
            ]} />
          </View>
          <View style={styles.rangeLimits}>
            <Text style={styles.rangeLimit}>{MIN_DAYS}d min</Text>
            <Text style={styles.rangeLimit}>{MAX_DAYS}d max</Text>
          </View>
        </View>

        {/* Quick shortcuts */}
        <Text style={[styles.sectionLabel, { marginTop: spacing['2xl'] }]}>QUICK SELECT</Text>
        <View style={styles.quickGrid}>
          {QUICK_OPTIONS.map(opt => {
            const active = opt.days === days;
            return (
              <TouchableOpacity
                key={opt.days}
                style={[styles.quickBtn, active && styles.quickBtnActive]}
                onPress={() => setDays(opt.days)}
              >
                <Text style={[styles.quickBtnText, active && styles.quickBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected range display */}
        <View style={styles.rangeCard}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeCol}>
              <Text style={styles.rangeColLabel}>PAUSE STARTS</Text>
              <Text style={styles.rangeDate}>{formatDateDisplay(todayStr)}</Text>
              <Text style={styles.rangeNote}>Today</Text>
            </View>
            <View style={styles.rangeDivider} />
            <View style={styles.rangeCol}>
              <Text style={styles.rangeColLabel}>RESUMES ON</Text>
              <Text style={[styles.rangeDate, { color: colors.gold }]}>
                {formatDateDisplay(selectedStr)}
              </Text>
              <Text style={styles.rangeNote}>Automatic</Text>
            </View>
          </View>
          <View style={styles.noBillingBanner}>
            <Text style={styles.noBillingText}>
              ✓ No charges during this period
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            • Minimum pause: {MIN_DAYS} days · Maximum: {MAX_DAYS} days{'\n'}
            • Your membership auto-resumes on the return date{'\n'}
            • You can resume early at any time from your profile{'\n'}
            • Session bookings during a pause are still available
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.cta, submitting && styles.ctaDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          <Text style={styles.ctaText}>
            {submitting ? 'Pausing…' : `Pause Until ${formatDateDisplay(selectedStr)}`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Never mind</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.darkest },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['7xl'] },

  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'],
  },
  emptyText: {
    color: colors.textMuted, fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md, textAlign: 'center', lineHeight: 22,
  },

  header:  { alignItems: 'center', paddingVertical: spacing['3xl'] },
  iconWrap: {
    width: 64, height: 64, borderRadius: radius['3xl'],
    backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.borderGold,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'],
  },
  title: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes['2xl'],
    color: colors.gold, marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.md,
    color: colors.textLight, textAlign: 'center', lineHeight: 22,
  },

  planCard: {
    backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius['2xl'], padding: spacing['2xl'], marginBottom: spacing['3xl'],
  },
  planLabel: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xs,
    color: colors.textMuted, letterSpacing: tracking.wider,
    textTransform: 'uppercase', marginBottom: spacing.xs,
  },
  planName: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xl, color: colors.textOnDark,
  },
  planAmount: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.md,
    color: colors.textMuted, marginTop: spacing.xs,
  },

  sectionLabel: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.sm,
    color: colors.gold, letterSpacing: tracking.wider, textTransform: 'uppercase',
    marginBottom: spacing.lg,
  },

  // ── Day stepper ──
  stepperCard: {
    backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius['2xl'], padding: spacing['3xl'], marginBottom: spacing.lg,
  },
  stepperCaption: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.xs,
    color: colors.textMuted, textAlign: 'center', marginBottom: spacing.xl,
    textTransform: 'uppercase', letterSpacing: tracking.wide,
  },
  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, marginBottom: spacing.xl,
  },
  stepBtn: {
    flexDirection: 'row', alignItems: 'center',
    width: 44, height: 44, borderRadius: radius.xl,
    backgroundColor: colors.darkest, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.3 },
  dayDisplay: {
    alignItems: 'center', minWidth: 80,
  },
  dayNumber: {
    fontFamily: fontFamilies.oswaldBold, fontSize: 48, color: colors.gold, lineHeight: 60,
  },
  dayLabel: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm,
    color: colors.textMuted, marginTop: -4,
  },
  rangeBar: {
    height: 4, backgroundColor: colors.darkest, borderRadius: 2,
    overflow: 'hidden', marginBottom: spacing.sm,
  },
  rangeFill: {
    height: '100%', backgroundColor: colors.gold, borderRadius: 2,
    minWidth: 4,
  },
  rangeLimits: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  rangeLimit: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.xs,
    color: colors.textMuted,
  },

  // ── Quick select ──
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing['3xl'],
  },
  quickBtn: {
    paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  quickBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  quickBtnText: {
    fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm, color: colors.textLight,
  },
  quickBtnTextActive: { color: colors.dark },

  // ── Range summary card ──
  rangeCard: {
    backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.borderGold,
    borderRadius: radius['2xl'], overflow: 'hidden', marginBottom: spacing['3xl'],
  },
  rangeRow:  { flexDirection: 'row', padding: spacing['2xl'] },
  rangeCol:  { flex: 1, alignItems: 'center' },
  rangeDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  rangeColLabel: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xs,
    color: colors.textMuted, letterSpacing: tracking.wider, textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  rangeDate: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg, color: colors.textOnDark,
  },
  rangeNote: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.xs,
    color: colors.textMuted, marginTop: 2,
  },
  noBillingBanner: {
    backgroundColor: colors.darkest, paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'], alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.borderGold,
  },
  noBillingText: {
    fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm, color: colors.gold,
  },

  // ── Info box ──
  infoBox: {
    backgroundColor: colors.darker, borderRadius: radius['2xl'],
    padding: spacing['2xl'], marginBottom: spacing['3xl'],
    borderWidth: 1, borderColor: colors.border,
  },
  infoText: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm,
    color: colors.textMuted, lineHeight: 20,
  },

  // ── CTA ──
  cta: {
    backgroundColor: colors.gold, borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'], alignItems: 'center', marginBottom: spacing.lg,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: {
    fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg,
    color: colors.dark, textTransform: 'uppercase', letterSpacing: tracking.wide,
  },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.lg },
  cancelText: {
    fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm,
    color: colors.textMuted, textDecorationLine: 'underline',
  },
});
