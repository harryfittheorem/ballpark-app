/**
 * ConnectHitTraxScreen — Me-tab entry to link or unlink the family kid's
 * HitTrax account at any time. The same component is reused from the post-
 * AddKid onboarding stack via AuthNavigator (see Auth/ConnectHitTraxScreen).
 *
 * States the screen renders, driven entirely off useHitTraxLink:
 *   - no link / removed: prompt + input + Connect button
 *   - pending          : waiting card ("check your email") + Cancel button
 *   - active           : connected card + last-poll timestamp + Disconnect
 *   - declined         : declined message + Try again button (re-shows form)
 */

import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input } from '@/components/ui';
import { useFamily } from '@/hooks/useFamily';
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
  const { kids } = useFamily();
  const kid = kids[0];
  const { data: link, isPending } = useHitTraxLink(kid?.id);
  const associate = useAssociateHitTrax(kid?.id);
  const disconnect = useDisconnectHitTrax(kid?.id);
  const [hittraxUserId, setHittraxUserId] = useState('');

  const onConnect = async () => {
    const trimmed = hittraxUserId.trim();
    if (trimmed.length === 0) {
      Alert.alert('HitTrax UserID required', 'Enter the HitTrax UserID your athlete uses to log in.');
      return;
    }
    try {
      const res = await associate.mutateAsync({ hittraxUserId: trimmed });
      if (!res.hittrax_registration_status) {
        Alert.alert(
          'HitTrax subscription needed',
          "Your HitTrax account doesn't currently have data sharing enabled. Upgrade in HitTrax, then try again.",
        );
      } else {
        Alert.alert(
          'Check the HitTrax email',
          "We've asked HitTrax to send you a confirmation email. Tap the link in that email to finish connecting — this screen will update automatically.",
        );
        setHittraxUserId('');
      }
    } catch (err) {
      Alert.alert('Connect failed', errorMessage(err));
    }
  };

  const onDisconnect = async () => {
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>HitTrax</Text>
        <Text style={styles.subtitle}>
          Link your athlete&apos;s HitTrax account and we&apos;ll pull every cage swing
          into Ballpark within ~5 minutes.
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
              <Text style={styles.cardLabel}>Connected</Text>
              <Text style={styles.cardValue}>
                HitTrax UserID: {link.external_user_id ?? '—'}
              </Text>
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
              <Text style={styles.cardLabel}>Waiting on email</Text>
              <Text style={styles.cardValue}>
                HitTrax sent a confirmation email to your athlete&apos;s HitTrax
                account. Tap the link in that email — this screen updates as soon
                as HitTrax tells us.
              </Text>
            </View>
            {/* Recovery action — never strand the parent in 'pending' if the
                email never arrives or they entered the wrong UserID. Cancel
                flips this row to 'removed' so the form re-appears for a
                fresh attempt. */}
            <Button
              variant="secondary"
              tone="danger"
              label="Cancel and start over"
              onPress={onDisconnect}
              loading={disconnect.isPending}
            />
          </View>
        ) : (
          <View>
            {link?.association_status === 'declined' ? (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Previously declined</Text>
                <Text style={styles.cardValue}>
                  The last HitTrax email was declined. Try again below.
                </Text>
              </View>
            ) : null}
            <Input
              label="HitTrax UserID"
              placeholder="e.g. coach.dave@infinitehitting.com"
              autoCapitalize="none"
              value={hittraxUserId}
              onChangeText={setHittraxUserId}
            />
            <Text style={styles.note}>
              This is the email or UserID your athlete uses to log into HitTrax
              online. We never see their password.
            </Text>
            <Button
              label="Connect HitTrax"
              onPress={onConnect}
              loading={associate.isPending}
            />
          </View>
        )}
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
  note: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.md,
    marginBottom: spacing['3xl'],
  },
});
