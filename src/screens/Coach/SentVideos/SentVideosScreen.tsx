/**
 * Coach sent-videos placeholder.
 *
 * Step 4.7 wires the "My Videos" card to a real route so navigation is in
 * place. The actual list of sent videos lands in Step 4.11.
 */

import { Send } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function SentVideosScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <Send size={32} color={colors.gold} />
        </View>
        <Text style={styles.title}>No videos yet</Text>
        <Text style={styles.body}>
          Once you send a video, it will show up here so you can find it later.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 20,
  },
});
