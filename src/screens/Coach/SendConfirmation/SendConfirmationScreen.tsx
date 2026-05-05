/**
 * Placeholder Send Confirmation screen.
 *
 * v0.4 Step 4.10 will replace this with the real flow that writes the
 * `coach_messages` row. Step 4.9 only needs a destination so the recipient
 * picker has something to push to — the screen renders all three params it
 * received so a phone tester can verify they're plumbed correctly.
 */

import { useRoute } from '@react-navigation/native';
import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Route = CoachInboxStackScreenProps<'SendConfirmation'>['route'];

export default function SendConfirmationScreen() {
  const route = useRoute<Route>();
  const { videoId, recipientFamilyId, recipientKidId } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <CheckCircle2 color={colors.success} size={48} />
        </View>
        <Text style={styles.title}>Recipient picked</Text>
        <Text style={styles.body}>
          Send confirmation lands in v0.4 Step 4.10. For now this screen
          confirms the picker passed the right params through.
        </Text>

        <Field label="Video ID" value={videoId} />
        <Field label="Family ID" value={recipientFamilyId} />
        <Field label="Kid ID" value={recipientKidId} />
      </View>
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.idBox}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={styles.idValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.lg,
  },
  iconWrap: { marginBottom: spacing['2xl'] },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.base,
  },
  body: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing['3xl'],
    lineHeight: 20,
  },
  idBox: {
    alignSelf: 'stretch',
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  idLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
    marginBottom: spacing.sm,
  },
  idValue: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    textAlign: 'center',
  },
});
