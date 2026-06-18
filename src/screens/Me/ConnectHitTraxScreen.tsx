/**
 * ConnectHitTraxScreen — Me-tab entry to link or unlink the family kid's
 * HitTrax account.
 *
 * Two ways to connect an existing HitTrax account:
 *   A. Password  — enter username + password (used once server-side, never stored)
 *   B. SMS code  — enter username → HitTrax texts a code → enter code
 *      (requires a phone number registered in HitTrax)
 *
 * Both paths go directly to 'active' — no email confirmation, no waiting.
 *
 * States:
 *   no link / removed / declined  → connect form (method picker)
 *   active                        → connected card + Disconnect button
 *   pending (v1.x legacy)         → "older link" card + Cancel and re-link
 */

import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '@/components/ui';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import type { MeStackScreenProps } from '@/navigation/types';
import {
  useAssociateHitTrax,
  useAssociateHitTraxWithOTP,
  useDisconnectHitTrax,
  useHitTraxLink,
  useTriggerHitTraxOTP,
} from '@/hooks/useHitTraxLink';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type AuthMethod = 'password' | 'otp';
type ConnectStep = 'choose' | 'otp_pending';

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'never';
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export default function ConnectHitTraxScreen() {
  const navigation = useNavigation<MeStackScreenProps<'ConnectHitTrax'>['navigation']>();
  const { kid } = useSelectedKid();
  const { data: link, isPending } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);
  const triggerOTP = useTriggerHitTraxOTP(kid?.id);
  const associateWithOTP = useAssociateHitTraxWithOTP(kid?.id);
  const disconnect = useDisconnectHitTrax(kid?.id);

  const [authMethod, setAuthMethod] = useState<AuthMethod>('password');
  const [connectStep, setConnectStep] = useState<ConnectStep>('choose');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const resetForm = () => {
    setUsername('');
    setPassword('');
    setOtpCode('');
    setConnectStep('choose');
    setAuthMethod('password');
  };

  const onConnect = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter the HitTrax username for this athlete.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Enter your HitTrax password.');
      return;
    }
    try {
      await associate.mutateAsync({ hittraxUsername: username.trim(), hittraxPassword: password });
      resetForm();
    } catch (err) {
      Alert.alert('Connect failed', errorMessage(err));
    }
  };

  const onSendCode = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter your HitTrax username so we know where to send the code.');
      return;
    }
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
    try {
      await associateWithOTP.mutateAsync({ hittraxUsername: username.trim(), otpCode: otpCode.trim() });
      resetForm();
    } catch (err) {
      Alert.alert('Verification failed', errorMessage(err));
    }
  };

  const onBackFromOTP = () => {
    setConnectStep('choose');
    setOtpCode('');
  };

  const onDisconnect = () => {
    Alert.alert(
      'Disconnect HitTrax?',
      "We'll stop pulling new swing data. Past sessions remain in your history.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnect.mutateAsync();
            } catch (err) {
              Alert.alert('Disconnect failed', errorMessage(err));
            }
          },
        },
      ],
    );
  };

  const showConnectForm =
    !link ||
    link.association_status === 'removed' ||
    link.association_status === 'declined';

  const isConnecting =
    associate.isPending || triggerOTP.isPending || associateWithOTP.isPending;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>HitTrax</Text>
        <Text style={styles.subtitle}>
          Link your athlete&apos;s HitTrax account and every cage swing syncs into
          Ballpark within ~5 minutes of a session ending.
        </Text>

        {!kid ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>No kid added yet</Text>
            <Text style={styles.cardValue}>Add your kid first to link a HitTrax account.</Text>
          </View>

        ) : isPending ? (
          <View style={styles.card}>
            <Text style={styles.cardValue}>Loading…</Text>
          </View>

        ) : link?.association_status === 'active' ? (
          <View>
            <View style={styles.card}>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>● CONNECTED</Text>
              </View>
              <Text style={styles.cardLabel}>HitTrax username</Text>
              <Text style={styles.cardValue}>{link.external_user_id ?? '—'}</Text>
              <Text style={styles.cardLabel}>Last sync</Text>
              <Text style={styles.cardValue}>
                {formatRelative(link.last_polled_at)}
                {link.last_poll_error ? ` — ${link.last_poll_error}` : ''}
              </Text>
            </View>
            <Button
              variant="secondary"
              tone="danger"
              label="Disconnect"
              onPress={onDisconnect}
              loading={disconnect.isPending}
            />
          </View>

        ) : link?.association_status === 'pending' ? (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Older link — action needed</Text>
              <Text style={styles.cardValue}>
                This link was created under an older version of the HitTrax
                integration. Tap &quot;Cancel and re-link&quot; below to switch to the
                new instant-connect flow — it only takes a few seconds.
              </Text>
            </View>
            <Button
              variant="secondary"
              tone="danger"
              label="Cancel and re-link"
              onPress={onDisconnect}
              loading={disconnect.isPending}
            />
          </View>

        ) : showConnectForm ? (
          <View>
            {link?.association_status === 'declined' ? (
              <View style={[styles.card, styles.cardWarning]}>
                <Text style={styles.cardLabel}>Previous attempt declined</Text>
                <Text style={styles.cardValue}>
                  Enter your HitTrax credentials below to try again.
                </Text>
              </View>
            ) : null}

            {connectStep === 'choose' ? (
              <View>
                <Input
                  label="HitTrax Username"
                  placeholder="Your HitTrax username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={username}
                  onChangeText={setUsername}
                  testID="connect-hittrax-username"
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
                          testID="connect-hittrax-password"
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
                    <Button
                      label="Connect HitTrax"
                      onPress={onConnect}
                      loading={associate.isPending}
                      testID="connect-hittrax-submit"
                    />
                  </View>
                ) : (
                  <View>
                    <Text style={styles.note}>
                      HitTrax will text a verification code to the phone number registered on your account. No password needed.
                    </Text>
                    <Button
                      label="Send Code to My Phone"
                      onPress={onSendCode}
                      loading={triggerOTP.isPending}
                      testID="connect-hittrax-send-otp"
                    />
                  </View>
                )}
              </View>

            ) : (
              <View>
                <View style={styles.card}>
                  <Text style={styles.connectedBadgeText}>📱 CODE SENT</Text>
                  <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>Username</Text>
                  <Text style={styles.cardValue}>{username}</Text>
                  <Text style={[styles.cardLabel, { marginTop: spacing.lg }]}>
                    Check your phone
                  </Text>
                  <Text style={styles.cardValue}>
                    HitTrax texted a verification code to the phone number on your account. Codes expire after 10 minutes.
                  </Text>
                </View>

                <Input
                  label="Verification Code"
                  placeholder="Enter the code from your text"
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  testID="connect-hittrax-otp-code"
                />

                <View style={styles.otpActions}>
                  <Button
                    label="Verify & Connect"
                    onPress={onVerifyOTP}
                    loading={associateWithOTP.isPending}
                    testID="connect-hittrax-verify-otp"
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
              </View>
            )}

            <TouchableOpacity
              style={styles.createHint}
              onPress={() => navigation.navigate('CreateHitTraxAccount')}
              activeOpacity={0.7}
            >
              <Text style={styles.createHintText}>
                Don&apos;t have a HitTrax account?{' '}
                <Text style={styles.createHintLink}>Create one in-app →</Text>
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: { padding: spacing['4xl'], paddingBottom: spacing['6xl'] },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    marginTop: spacing.sm,
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
  cardWarning: {
    borderColor: colors.gold,
  },
  connectedBadge: {
    marginBottom: spacing.lg,
  },
  connectedBadgeText: {
    color: '#4ade80',
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.xs,
    letterSpacing: tracking.wide,
  },
  cardLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginTop: spacing.lg,
  },
  cardValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
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
  otpActions: {
    marginTop: spacing['2xl'],
    gap: spacing.md,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: spacing.md,
  },
  backLinkText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  createHint: {
    marginTop: spacing['2xl'],
    alignItems: 'center',
  },
  createHintText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  createHintLink: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
  },
});
