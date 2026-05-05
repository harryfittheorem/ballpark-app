import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resendSignUpConfirmation, signInParent } from '@/api/auth';
import type { AuthStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

type Props = AuthStackScreenProps<'ConfirmEmail'>;

const POLL_INTERVAL_MS = 4000;

export default function ConfirmEmailScreen({ route, navigation }: Props) {
  const { email, password } = route.params;
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resentAt, setResentAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  // Try to sign the user in. Until they click the confirmation link in their
  // inbox, Supabase rejects with "Email not confirmed" — we treat that as
  // "still waiting" and keep polling. Once it succeeds, the AuthProvider's
  // onAuthStateChange listener will swap RootNavigator over to the main stack
  // automatically, so we don't have to navigate manually here.
  const attemptSignIn = async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setChecking(true);
    try {
      await signInParent(email, password);
    } catch (err) {
      if (manual) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        Alert.alert('Not confirmed yet', msg);
      }
    } finally {
      inFlight.current = false;
      if (manual) setChecking(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      void attemptSignIn(false);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendSignUpConfirmation(email);
      setResentAt(new Date());
    } catch (err) {
      Alert.alert('Could not resend', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.brand}>BALLPARK</Text>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email}</Text>
        </Text>
        <Text style={styles.hint}>
          Tap the link in that email to finish creating your account. We'll sign you in
          automatically once you do.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, checking && styles.btnDisabled]}
          onPress={() => attemptSignIn(true)}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={colors.darkest} />
          ) : (
            <Text style={styles.primaryBtnText}>I've confirmed — sign me in</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, resending && styles.btnDisabled]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <Text style={styles.secondaryBtnText}>Resend confirmation</Text>
          )}
        </TouchableOpacity>

        {resentAt && (
          <Text style={styles.sentNote}>Sent again at {resentAt.toLocaleTimeString()}</Text>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('SignIn')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: { flex: 1, padding: spacing['4xl'], justifyContent: 'center' },
  brand: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    textAlign: 'center',
    marginBottom: spacing['4xl'],
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes['2xl'],
    marginBottom: spacing['2xl'],
    textAlign: 'center',
  },
  body: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  email: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginBottom: spacing['4xl'],
  },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  secondaryBtn: {
    borderColor: colors.gold,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  secondaryBtnText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sentNote: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
  linkBtn: { marginTop: spacing['3xl'], alignItems: 'center' },
  linkText: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
  },
});
