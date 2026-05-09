/**
 * TrainScreen — v0.7 task #119 placeholder.
 *
 * The Train tab is a marquee surface in the spec but the content
 * (programmed workouts, plan-of-the-week, etc.) ships in a later task.
 * For now we render a brand-consistent "coming soon" shell so the 7-tab
 * layout has a real Train screen — empty, but never broken.
 */

import { Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export default function TrainScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Train</Text>
        <Text style={styles.subtitle}>Programmed workouts and plans</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Sparkles size={26} color={colors.gold} />
          </View>
          <Text style={styles.cardTitle}>COMING SOON</Text>
          <Text style={styles.cardBody}>
            Your coach will publish daily workouts, mobility flows, and skill drills here.
            Until then, head to Work for assigned drills.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.xs,
  },
  body: { flex: 1, padding: spacing['3xl'] },
  card: {
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['4xl'],
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  cardTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    letterSpacing: tracking.wide,
  },
  cardBody: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
});
