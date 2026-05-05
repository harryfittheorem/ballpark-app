/**
 * Video Playback screen — stub for v0.4 Step 4.13.
 *
 * Step 4.12 only introduces the navigation route + param so the Home tab's
 * coach video card can push to it. The real Mux player + "mark viewed"
 * mutation land in 4.13.
 */

import { useRoute } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { HomeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

type Route = HomeStackScreenProps<'VideoPlayback'>['route'];

export default function VideoPlaybackScreen() {
  const route = useRoute<Route>();
  const { messageId } = route.params;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.body}>
        <Text style={styles.label}>Message ID</Text>
        <Text style={styles.value}>{messageId}</Text>
        <Text style={styles.hint}>Playback lands in Step 4.13.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
    gap: spacing.md,
  },
  label: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
  },
  value: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  hint: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xl,
  },
});
