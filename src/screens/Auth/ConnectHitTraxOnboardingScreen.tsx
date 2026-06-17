/**
 * ConnectHitTraxOnboardingScreen — post-AddKid onboarding step.
 *
 * Two ways to connect an existing HitTrax account:
 *   A. Password  — enter username + password (used once, never stored)
 *   B. SMS code  — enter username → HitTrax texts code → enter code
 *      (requires a phone number registered in HitTrax)
 *
 * Both go directly to 'active'. On success we pop to Home.
 * "Skip for now" is always available — Home shows a nudge banner later.
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
import {
  useAssociateHitTrax,
  useAssociateHitTraxWithOTP,
  useHitTraxLink,
  useTriggerHitTraxOTP,
} from '@/hooks/useHitTraxLink';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

type AuthMethod = 'password' | 'otp';
type ConnectStep = 'choose' | 'otp_pending';

export default function ConnectHitTraxOnboardingScreen() {
  const navigation = useNavigation<HomeStackScreenProps<'ConnectHitTraxOnboarding'>['navigation']>();
  const route = useRoute<HomeStackScreenProps<'ConnectHitTraxOnboarding'>['route']>();
  const { kids } = useFamily();
  const routedKidId = route.params?.kidId;
  const kid = routedKidId ? kids.find((k) => k.id === routedKidId) ?? { id: routedKidId } : kids[0];
  const { data: link } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);
  const triggerOTP = useTriggerHitTraxOTP(kid?.id);
  const associateWithOTP = useAssociateHitTraxWithOTP(kid?.id);

  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [connectStep, setConnectStep] = useState<ConnectStep>('choose');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const goHome = () => navigation.popToTop();

  const onConnect = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter the HitTrax username for this athlete.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Enter your HitTrax password.');
      return;
    }
    if (!kid) { Alert.alert('No kid found', 'Add a kid first.'); return; }
    try {
      await associate.mutateAsync({ hittraxUsername: username.trim(), hittraxPassword: password });
      goHome();
    } catch (err) {
      Alert.alert('Connect failed', errorMessage(err));
    }
  };

  const onSendCode = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter your HitTrax username so we know where to send the code.');
      return;
    }
    if (!kid) { Alert.alert('No kid found', 'Add a kid first.'); return; }
    try {
      await triggerOTP.mutateAsync({ hittraxUsername: username.trim() });
      setConnectStep('otp_pending');
    } catch (err) {
      Alert.alert('Could not send code', errorMessage(err));
    }
  };

  const onVerifyOTP = async () => {
    if (!otpCode.trim()) {
      Alert.alert('Code required', 'Enter the code texted to your phone.');
      return;
    }
    if (!kid) { Alert.alert('No kid found', 'Add a kid first.'); return; }
    try {
      await associateWithOTP.mutateAsync({ hittraxUsername: username.trim(), otpCode: otpCode.trim() });
      goHome();
    } catch (err) {
      Alert.alert('Verification failed', errorMessage(err));
    }
  };

  const onBackFromOTP = () => {
    setConnectStep('choose');
    setOtpCode('');
  };

  const alreadyActive = link?.association_status === 'active';
  const isConnecting =
    associate.isPending || triggerOTP.isPending || associateWithOTP.isPending;

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
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Previous link pending</Text>
                <Text style={styles.cardValue}>
                  An older link is waiting on email confirmation. Go to
                  Me → HitTrax to cancel it and re-link with the new
                  instant-connect flow.
                </Text>
              </View>

            ) : connectStep === 'choose' ? (
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

                <Text style={styles.methodLabel}>How would you like to verify?</Text>
                <View style={styles.methodPicker}>
                  <TouchableOpacity
                    style={[styles.methodTab, authMethod === 'password' && styles.methodTabActive]}
                    onPress={() => setAuthMethod('password')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.methodTabText, authMethod === 'password' && styles.methodTabTextActive]}>
                      My password
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.methodTab, authMethod === 'otp' && styles.methodTabActive]}
                    onPress={() => setAuthMethod('otp')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.methodTabText, authMethod === 'otp' && styles.methodTabTextActive]}>
                      Text me a code
                    </Text>
                  </TouchableOpacity>
                </View>

                {authMethod === 'password' ? (
                  <View>
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
                      Your password is used once to verify with HitTrax — it is never stored by Ballpark.
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.note}>
                    HitTrax will text a verification code to the phone number registered on your account. No password needed.
                  </Text>
                )}
              </View>

            ) : (
              <View>
                <View style={styles.card}>
                  <Text style={styles.cardLabel}>📱 Code sent</Text>
                  <Text style={styles.cardValue}>
                    HitTrax texted a code to the phone number on your account.
                    Codes expire after 10 minutes.
                  </Text>
                  <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>Username</Text>
                  <Text style={styles.cardValue}>{username}</Text>
                </View>

                <Input
                  label="Verification Code"
                  placeholder="Enter the code from your text"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  testID="connect-hittrax-onboarding-otp-code"
                />
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

            ) : connectStep === 'otp_pending' ? (
              <View>
                <Button
                  label="Verify & Connect"
                  onPress={onVerifyOTP}
                  loading={associateWithOTP.isPending}
                  testID="connect-hittrax-onboarding-verify-otp"
                />
                <TouchableOpacity
                  style={styles.backLink}
                  onPress={onBackFromOTP}
                  disabled={isConnecting}
                  hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
                >
                  <Text style={styles.backLinkText}>← Back</Text>
                </TouchableOpacity>
              </View>

            ) : authMethod === 'password' ? (
              <Button
                label="Connect HitTrax"
                onPress={onConnect}
                loading={associate.isPending}
                testID="connect-hittrax-onboarding-connect"
              />
            ) : (
              <Button
                label="Send Code to My Phone"
                onPress={onSendCode}
                loading={triggerOTP.isPending}
                testID="connect-hittrax-onboarding-send-otp"
              />
            )}

            {!(alreadyActive || link?.association_status === 'pending') ? (
              <View style={styles.skipWrap}>
                <Button
                  label="Skip for now"
                  onPress={goHome}
                  variant="tertiary"
                  tone="muted"
                  disabled={isConnecting}
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
  methodLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  methodPicker: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing['2xl'],
  },
  methodTab: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
    alignItems: 'center',
  },
  methodTabActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  methodTabText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  methodTabTextActive: {
    color: colors.gold,
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
  backLink: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  backLinkText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  footnote: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
