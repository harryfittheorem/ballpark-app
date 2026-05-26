import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, ChevronRight } from 'lucide-react-native';

import { useMembership } from '@/hooks/useMembership';
import { fetchUpgradePlans, type MembershipPlan } from '@/api/membership';
import { useFamily } from '@/hooks/useFamily';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type ScreenState = 'loading' | 'plans' | 'confirming' | 'success' | 'error';

export default function UpgradeMembershipScreen() {
  const { membership, upgrade } = useMembership();
  const { family } = useFamily();

  const [state, setState] = useState<ScreenState>('loading');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tenantId = family?.tenant_id as string | undefined;

  const loadPlans = useCallback(async () => {
    if (!membership || !tenantId) return;
    setState('loading');
    setFetchError(null);
    try {
      const result = await fetchUpgradePlans(tenantId, membership.amount_cents);
      setPlans(result);
      setState('plans');
    } catch (err) {
      setFetchError(errorMessage(err));
      setState('error');
    }
  }, [membership, tenantId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleConfirm = useCallback(async () => {
    if (!selectedPlanId) return;
    setState('confirming');
    setSubmitError(null);
    try {
      await upgrade(selectedPlanId);
      setState('success');
    } catch (err) {
      setSubmitError(errorMessage(err));
      setState('plans');
    }
  }, [selectedPlanId, upgrade]);

  if (state === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Couldn't load plans</Text>
          <Text style={styles.errorBody}>{fetchError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPlans} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (state === 'success') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.centered}>
          <CheckCircle size={56} color={colors.success} style={styles.successIcon} />
          <Text style={styles.successTitle}>Request Sent!</Text>
          <Text style={styles.successBody}>
            We've sent your upgrade request — we'll be in touch shortly to confirm the change.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Choose a Plan</Text>
        <Text style={styles.subheading}>
          Select a higher-tier plan and we'll process your upgrade request.
        </Text>

        {plans.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No upgrade plans are available right now. Contact us to learn about your options.
            </Text>
          </View>
        ) : (
          plans.map(plan => {
            const isSelected = plan.id === selectedPlanId;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.planCard, isSelected && styles.planCardSelected]}
                onPress={() => setSelectedPlanId(plan.id)}
                activeOpacity={0.8}
              >
                <View style={styles.planCardRow}>
                  <View style={styles.planCardMain}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <Text style={styles.planPrice}>
                      ${(plan.amount_cents / 100).toFixed(2)}/mo
                    </Text>
                    {plan.description ? (
                      <Text style={styles.planDescription}>{plan.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleFilled]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {submitError ? (
          <Text style={styles.submitError}>{submitError}</Text>
        ) : null}

        {plans.length > 0 && (
          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!selectedPlanId || state === 'confirming') && styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={!selectedPlanId || state === 'confirming'}
          >
            {state === 'confirming' ? (
              <ActivityIndicator color={colors.darkest} size="small" />
            ) : (
              <View style={styles.confirmButtonInner}>
                <Text style={styles.confirmButtonText}>
                  {selectedPlan
                    ? `Request Upgrade to ${selectedPlan.name}`
                    : 'Select a Plan to Continue'}
                </Text>
                {selectedPlanId ? (
                  <ChevronRight size={18} color={colors.darkest} />
                ) : null}
              </View>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.disclaimer}>
          This submits a request to our team. We'll reach out to confirm availability and process the change in your billing.
        </Text>
      </ScrollView>
    </SafeAreaView>
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

  heading: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginBottom: spacing.md,
  },
  subheading: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing['4xl'],
  },

  emptyBox: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  planCard: {
    backgroundColor: colors.darker,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  planCardSelected: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}0D`,
  },
  planCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xl'],
  },
  planCardMain: {
    flex: 1,
  },
  planName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    marginBottom: spacing.xs,
  },
  planPrice: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  planDescription: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleFilled: {
    borderColor: colors.gold,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },

  confirmButton: {
    backgroundColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing['2xl'],
    minHeight: 52,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmButtonText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.darkest,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },

  disclaimer: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing['3xl'],
  },
  retryButton: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['4xl'],
  },
  retryButtonText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },

  successIcon: {
    marginBottom: spacing['3xl'],
  },
  successTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  submitError: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.danger,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
