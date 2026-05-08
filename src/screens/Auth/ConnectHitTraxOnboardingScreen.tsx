/**
 * ConnectHitTraxOnboardingScreen — post-AddKid onboarding step.
 *
 * This is the onboarding-flavoured twin of Me/ConnectHitTraxScreen. It runs
 * inline (not via a redirect) so the parent can complete the connection in
 * the same flow as Add Kid. Two affordances:
 *
 *   1. Inline HitTrax UserID input + helper text + "Connect HitTrax" button.
 *      Submitting calls hittrax-associate; on success we surface the
 *      "check your HitTrax email" card AND let the parent tap Continue to
 *      land on Home — the link will flip to active in the background once
 *      HitTrax POSTs hittrax-registration-complete (Realtime hook updates
 *      the Home banner with no manual refresh).
 *   2. "Skip for now" button — pops back to Home. The Home banner remains
 *      as a passive nudge so a parent who skips here can connect later
 *      from Home or Me → HitTrax.
 *
 * Lifecycle note: hittrax-associate is now atomic — the kid_capture_links
 * row is only written AFTER HitTrax accepts the request. On any HitTrax
 * error (timeout, unreachable, bad UserID) we surface the message and
 * keep the form ready for retry; the parent is never stranded in
 * 'pending' on this screen.
 */

import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '@/components/ui';
import { useFamily } from '@/hooks/useFamily';
import { useAssociateHitTrax, useHitTraxLink } from '@/hooks/useHitTraxLink';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

export default function ConnectHitTraxOnboardingScreen() {
  const navigation = useNavigation<HomeStackScreenProps<'ConnectHitTraxOnboarding'>['navigation']>();
  const { kids } = useFamily();
  const kid = kids[0];
  const { data: link } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);
  const [hittraxUserId, setHittraxUserId] = useState('');
  // Local "we just submitted, the email is on its way" flag. Kept separate
  // from the link.association_status so we can show the success card even
  // before Realtime delivers the row (the row IS persisted at this point —
  // hittrax-associate writes it after HitTrax accepts — but the React
  // Query refetch may lag the navigation by a tick).
  const [submittedOk, setSubmittedOk] = useState(false);

  const goHome = () => navigation.popToTop();

  const onConnect = async () => {
    const trimmed = hittraxUserId.trim();
    if (trimmed.length === 0) {
      Alert.alert('HitTrax UserID required', 'Enter the HitTrax UserID your athlete uses to log in.');
      return;
    }
    if (!kid) {
      Alert.alert('No kid found', 'Add a kid first.');
      return;
    }
    try {
      const res = await associate.mutateAsync({ hittraxUserId: trimmed });
      // Atomic associate succeeded — link is now persisted in 'pending'.
      // Show the appropriate next step based on the registration boolean.
      if (!res.hittrax_registration_status) {
        Alert.alert(
          'HitTrax subscription needed',
          "Your HitTrax account doesn't currently have data sharing enabled. Upgrade in HitTrax, then try again.",
        );
        // Do NOT auto-advance — let the parent fix it and re-submit, or Skip.
        return;
      }
      setSubmittedOk(true);
    } catch (err) {
      // hittrax-associate is atomic: a thrown error here means HitTrax
      // refused (or was unreachable) and NO row was written. The parent
      // can correct the UserID and retry without being stuck in 'pending'.
      Alert.alert('Connect failed', errorMessage(err));
    }
  };

  // Already-active edge case: if the parent had an active link from a
  // prior kid (one-kid-per-family today, but futureproof) we skip the
  // form and just acknowledge.
  const alreadyActive = link?.association_status === 'active';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.title}>Connect HitTrax</Text>
            <Text style={styles.subtitle}>
              Pull your kid&apos;s cage swings into Ballpark automatically — exit
              velo, distance, and personal bests show up within a few minutes
              of every session. Requires a HitTrax membership.
            </Text>

            {alreadyActive ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Already connected</Text>
                <Text style={styles.cardValue}>
                  This kid&apos;s HitTrax account is linked. You can manage it any
                  time from Me → HitTrax.
                </Text>
              </View>
            ) : submittedOk || link?.association_status === 'pending' ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Check your HitTrax email</Text>
                <Text style={styles.cardValue}>
                  We&apos;ve asked HitTrax to send a confirmation email. Tap the
                  link in that email to finish connecting — Ballpark will start
                  pulling swings within a few minutes after you confirm. You
                  can continue to Home; the connection updates automatically.
                </Text>
              </View>
            ) : (
              <View>
                <Input
                  label="HitTrax UserID"
                  placeholder="e.g. coach.dave@infinitehitting.com"
                  autoCapitalize="none"
                  value={hittraxUserId}
                  onChangeText={setHittraxUserId}
                  testID="connect-hittrax-onboarding-userid"
                />
                <Text style={styles.note}>
                  This is the email or UserID your athlete uses to log into
                  HitTrax online. We never see their password.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {alreadyActive || submittedOk || link?.association_status === 'pending' ? (
              <Button
                label="Continue to Home"
                onPress={goHome}
                testID="connect-hittrax-onboarding-continue"
              />
            ) : (
              <Button
                label="Connect HitTrax"
                onPress={onConnect}
                loading={associate.isPending}
                testID="connect-hittrax-onboarding-connect"
              />
            )}
            {!(alreadyActive || submittedOk || link?.association_status === 'pending') ? (
              <View style={styles.skipWrap}>
                <Button
                  label="Skip for now"
                  onPress={goHome}
                  variant="tertiary"
                  tone="muted"
                  disabled={associate.isPending}
                  testID="connect-hittrax-onboarding-skip"
                />
              </View>
            ) : null}
            <Text style={styles.footnote}>
              You can connect or change this any time from Me → HitTrax.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: spacing['4xl'],
    paddingBottom: spacing['6xl'],
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    marginBottom: spacing.lg,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    marginBottom: spacing['3xl'],
  },
  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing['3xl'],
    marginBottom: spacing['3xl'],
  },
  cardLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cardValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    lineHeight: 22,
  },
  note: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
    marginBottom: spacing['3xl'],
  },
  actions: { marginTop: spacing['3xl'] },
  skipWrap: { marginTop: spacing.md },
  footnote: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
