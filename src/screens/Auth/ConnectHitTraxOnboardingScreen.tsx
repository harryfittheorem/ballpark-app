/**
 * ConnectHitTraxOnboardingScreen — post-AddKid step.
 *
 * After a parent finishes Add Kid we route here. The screen offers two
 * branches:
 *   1. "Connect HitTrax now" → cross-tab navigation to Me → ConnectHitTrax,
 *      where the existing form lives. We replace this screen first so
 *      back-swipe doesn't return to the onboarding gate.
 *   2. "Skip for now" → pop back to Home. The HomeScreen banner remains as
 *      a passive reminder, so a parent who skips here still has a clear
 *      path to connect later.
 *
 * The screen has no side-effects on mount — it never auto-navigates and
 * never mutates the link. A parent without a HitTrax membership can
 * complete onboarding by tapping Skip.
 */

import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

export default function ConnectHitTraxOnboardingScreen() {
  // Cross-tab nav requires the composite (tab + stack) navigator type.
  const navigation = useNavigation<HomeStackScreenProps<'ConnectHitTraxOnboarding'>['navigation']>();

  const onConnect = () => {
    // Replace so the back gesture doesn't strand the parent on this gate.
    // The Me-stack ConnectHitTrax screen is the canonical form; deep-link
    // into it via cross-tab navigation.
    navigation.popToTop();
    navigation.getParent()?.navigate('Me', { screen: 'ConnectHitTrax' });
  };

  const onSkip = () => {
    // Skip → back to Home. The HomeScreen ConnectHitTraxBanner remains
    // visible as a passive nudge; the parent can connect later from
    // there or from the Me tab.
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Connect HitTrax</Text>
          <Text style={styles.subtitle}>
            Pull your kid&apos;s cage swings into Ballpark automatically — exit velo,
            distance, and personal bests show up within a few minutes of every
            session. You&apos;ll need a HitTrax membership.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Connect HitTrax now"
            onPress={onConnect}
            testID="connect-hittrax-onboarding-connect"
          />
          <View style={styles.skipWrap}>
            <Button
              label="Skip for now"
              onPress={onSkip}
              variant="tertiary"
              tone="muted"
              testID="connect-hittrax-onboarding-skip"
            />
          </View>
          <Text style={styles.footnote}>
            You can connect or change this any time from Me → Connect HitTrax.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: {
    flex: 1,
    padding: spacing['4xl'],
    justifyContent: 'space-between',
  },
  header: { marginTop: spacing['4xl'] },
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
  },
  actions: { marginBottom: spacing['4xl'] },
  skipWrap: { marginTop: spacing.md },
  footnote: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
