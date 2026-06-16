/**
 * ConnectHitTraxScreen — Me-tab entry to link or unlink the family kid's
 * HitTrax account.
 *
 * v1.3 flow: parent enters their HitTrax username + password → we
 * authenticate server-side → the link goes directly to 'active'. No email
 * confirmation, no waiting. Swings appear within ~5 minutes.
 *
 * States:
 *   no link / removed / declined  → connect form (username + password)
 *   active                        → connected card + Disconnect button
 *   pending (v1.x legacy)         → "waiting on email" card + Cancel button
 */

import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '@/components/ui';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import {
  useAssociateHitTrax,
  useDisconnectHitTrax,
  useHitTraxLink,
} from '@/hooks/useHitTraxLink';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

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
  const { kid } = useSelectedKid();
  const { data: link, isPending } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);
  const disconnect = useDisconnectHitTrax(kid?.id);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const onConnect = async () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter the HitTrax username for this athlete.');
      return;
    }
    if (!password) {
      Alert.alert('Password required', 'Enter the HitTrax password for this athlete.');
      return;
    }
    try {
      await associate.mutateAsync({ hittraxUsername: username.trim(), hittraxPassword: password });
      setUsername('');
      setPassword('');
    } catch (err) {
      Alert.alert('Connect failed', errorMessage(err));
    }
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
          // Legacy v1.x users who linked before the API upgrade.
          // They never got a ThirdPartyPassword — the only path forward is
          // to cancel and re-link via the new v1.3 flow.
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Waiting on email confirmation</Text>
              <Text style={styles.cardValue}>
                Your link was created under an older version of the HitTrax
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
              We authenticate directly with HitTrax — your password is never
              stored by Ballpark.
            </Text>

            <Button
              label="Connect HitTrax"
              onPress={onConnect}
              loading={associate.isPending}
              testID="connect-hittrax-submit"
            />

            <View style={styles.createHint}>
              <Text style={styles.createHintText}>
                Don&apos;t have a HitTrax account?{' '}
                <Text style={styles.createHintLink}>Create one in-app — coming soon.</Text>
              </Text>
            </View>
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
