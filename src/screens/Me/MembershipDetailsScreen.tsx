import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info, Star } from 'lucide-react-native';

import { useMembership } from '@/hooks/useMembership';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

function formatDate(isoDate: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(isoDate + 'T00:00:00');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function nextBillingDate(anchorDay: number | null): string {
  if (!anchorDay) return '—';
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), anchorDay);
  if (thisMonth > now) return formatDate(thisMonth.toISOString().slice(0, 10));
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, anchorDay);
  return formatDate(nextMonth.toISOString().slice(0, 10));
}

export default function MembershipDetailsScreen() {
  const { membership, loading } = useMembership();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!membership) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No active membership</Text>
          <Text style={styles.emptyBody}>
            You don't have an active membership on file. Visit us or give us a call — we'd love to get you set up!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPaused = membership.status === 'paused';
  const statusLabel = isPaused ? 'Paused' : 'Active';
  const planTypeLabel = membership.plan_type === 'eft' ? 'Monthly EFT' : 'Session Pack';
  const amountLabel =
    membership.plan_type === 'eft'
      ? `$${(membership.amount_cents / 100).toFixed(2)}/mo`
      : `$${(membership.amount_cents / 100).toFixed(2)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Star size={28} color={colors.gold} />
        </View>

        <View style={styles.card}>
          <DetailRow label="Plan" value={membership.plan_name} />
          <DetailRow label="Type" value={planTypeLabel} />
          <DetailRow label="Amount" value={amountLabel} />
          {membership.plan_type === 'eft' && (
            <DetailRow
              label="Next billing"
              value={
                isPaused
                  ? (membership.pause_end ? `Resumes ${formatDate(membership.pause_end)}` : '—')
                  : nextBillingDate(membership.billing_anchor_day)
              }
            />
          )}
          <DetailRow
            label="Status"
            value={statusLabel}
            valueTone={isPaused ? 'gold' : 'success'}
            last
          />
        </View>

        {isPaused && membership.pause_end ? (
          <View style={styles.pauseNotice}>
            <Text style={styles.pauseNoticeText}>
              Your membership is paused until {formatDate(membership.pause_end)}. Billing resumes automatically on that date.
            </Text>
          </View>
        ) : null}

        <View style={styles.infoBox}>
          <View style={styles.infoBoxHeader}>
            <Info size={16} color={colors.textMuted} />
            <Text style={styles.infoBoxTitle}>Making changes?</Text>
          </View>
          <Text style={styles.infoBoxBody}>
            To pause or cancel your membership, please visit us in person or give us a call — we're happy to help!
          </Text>
          <Text style={styles.infoBoxContact}>
            📍 Infinite Hitting{'\n'}
            📞 (555) 000-0000
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  valueTone,
  last = false,
}: {
  label: string;
  value: string;
  valueTone?: 'success' | 'gold';
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          valueTone === 'success' ? { color: colors.success } : null,
          valueTone === 'gold' ? { color: colors.gold } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: {
    padding: spacing['3xl'],
    paddingBottom: spacing['7xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },

  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius['3xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing['3xl'],
  },

  card: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    marginBottom: spacing['3xl'],
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  detailValue: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },

  pauseNotice: {
    backgroundColor: `${colors.gold}18`,
    borderWidth: 1,
    borderColor: `${colors.gold}44`,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    marginBottom: spacing['3xl'],
  },
  pauseNoticeText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 20,
  },

  infoBox: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoBoxTitle: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  infoBoxBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  infoBoxContact: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 22,
  },
});
