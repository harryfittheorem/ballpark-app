/**
 * Placeholder destination after a successful video upload.
 *
 * The actual recipient picker (search families, pick a kid, attach an
 * optional message, INSERT into `coach_messages`) is Step 4.9. For Step
 * 4.6 this screen exists only so we can verify the upload flow end-to-end:
 * if the videoId shows up here, the function call + Mux PUT both
 * succeeded, and the corresponding `videos` row exists in Postgres.
 */

import { useRoute } from '@react-navigation/native';
import { CheckCircle2 } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Route = CoachInboxStackScreenProps<'RecipientPicker'>['route'];

export default function RecipientPickerScreen() {
  const route = useRoute<Route>();
  const { videoId } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <CheckCircle2 color={colors.success} size={48} />
        </View>
        <Text style={styles.title}>Upload complete</Text>
        <Text style={styles.body}>
          Recipient picker lands in v0.4 Step 4.9. For now this confirms the
          video uploaded successfully.
        </Text>
        <View style={styles.idBox}>
          <Text style={styles.idLabel}>Video ID</Text>
          <Text style={styles.idValue} selectable>
            {videoId}
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  iconWrap: {
    marginBottom: spacing['3xl'],
  },
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
    marginBottom: spacing['4xl'],
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
