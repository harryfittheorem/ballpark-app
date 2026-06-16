/**
 * ConnectHitTraxOnboardingScreen — post-AddKid onboarding step.
 *
 * v1.3 flow: parent enters HitTrax username + password → we authenticate
 * server-side → the link activates immediately. No email wait, no pending
 * state. On success we pop to Home and swings start appearing within ~5 min.
 *
 * Two affordances:
 *   1. HitTrax username + password form → "Connect HitTrax" button
 *   2. "Skip for now" → pops to Home (Home banner nudges later)
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const route = useRoute<HomeStackScreenProps<'ConnectHitTraxOnboarding'>['route']>();
  const { kids } = useFamily();
  const routedKidId = route.params?.kidId;
  const kid = routedKidId ? kids.find((k) => k.id === routedKidId) ?? { id: routedKidId } : kids[0];
  const { data: link } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const goHome = () => navigation.popToTop();

  const onConnect = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter the HitTrax username for this athlete.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Enter the HitTrax password for this athlete.');
      return;
    }
    if (!kid) {
      Alert.alert('No kid found', 'Add a kid first.');
      return;
    }
    try {
      await associate.mutateAsync({ hittraxUsername: username.trim(), hittraxPassword: password });
      // v1.3: link is immediately active — go straight to Home.
      // The Work/Swings screen will show data within ~5 minutes.
      goHome();
    } catch (err) {
      // hittrax-associate is atomic — on any error no row is written.
      // The parent can fix credentials and retry immediately.
      Alert.alert('Connect failed', errorMessage(err));
    }
  };

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
              Pull your athlete&apos;s cage swings into Ballpark automatically — exit
              velo, distance, and personal bests appear within ~5 minutes of
              every session. Requires a HitTrax account.
            </Text>

            {alreadyActive ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Already connected</Text>
                <Text style={styles.cardValue}>
                  HitTrax is linked. Manage it any time from Me → HitTrax.
                </Text>
              </View>

            ) : link?.association_status === 'pending' ? (
              // Legacy v1.x user — guide them to cancel + re-link.
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Previous link pending</Text>
                <Text style={styles.cardValue}>
                  An older link is waiting on email confirmation. Go to
                  Me → HitTrax to cancel it and re-link with the new
                  instant-connect flow.
                </Text>
              </View>

            ) : (
              <View>
                <Input
                  label="HitTrax Username"
                  placeholder="Your HitTrax username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={username}
                  onChangeText={setUsername}
                  testID="connect-hittrax-onboarding-username"
                />

                <View style={styles.passwordRow}>
                  <View style={styles.passwordInput}>
                    <Input
                      label="HitTrax Password"
                      placeholder="Your HitTrax password"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={setPassword}
                      testID="connect-hittrax-onboarding-password"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.showHide}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.note}>
                  We verify directly with HitTrax — your password is never
                  stored by Ballpark.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {alreadyActive || link?.association_status === 'pending' ? (
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

            {!(alreadyActive || link?.association_status === 'pending') ? (
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  passwordInput: {
    flex: 1,
  },
  showHide: {
    paddingBottom: spacing.md,
  },
  showHideText: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  note: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
    marginBottom: spacing['3xl'],
    lineHeight: 18,
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
