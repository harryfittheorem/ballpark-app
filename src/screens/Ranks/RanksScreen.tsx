/**
 * RanksScreen — task #119.
 *
 * Promoted from the Earn → Ranks sub-tab to its own bottom tab. Reuses
 * the existing RanksTab component verbatim so leaderboard logic stays
 * in one place.
 */

import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RanksTab from '@/screens/Earn/components/RanksTab';
import { useFamily } from '@/hooks/useFamily';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

export default function RanksScreen() {
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Ranks</Text>
        <Text style={styles.subtitle}>Tenant leaderboard, top to bottom</Text>
      </View>
      <View style={styles.body}>
        <RanksTab ownKidIds={kid ? [kid.id] : []} />
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
  body: { flex: 1 },
});
