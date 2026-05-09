import { useNavigation } from '@react-navigation/native';
import { Calendar, Coins, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { HomeStackScreenProps } from '@/navigation/types';
import { spacing } from '@/theme';

import QuickAction from './QuickAction';

const ICON_SIZE = 24;

type Nav = HomeStackScreenProps<'HomeMain'>['navigation'];

/**
 * Task #135 — bottom nav consolidated to 5 tabs (Home / Work / Book /
 * Earn / Me). Quick Actions jump straight to the destination tab; the
 * Earn tab carries an optional `initialSubTab` so View Leaderboard
 * lands on the Ranks pill.
 */
export default function QuickActionsRow() {
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.row}>
      <QuickAction
        icon={<Calendar size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="Book Session"
        onPress={() => navigation.navigate('Book')}
      />
      <QuickAction
        icon={<Trophy size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="View Leaderboard"
        onPress={() =>
          navigation.navigate('Earn', {
            screen: 'EarnHome',
            params: { initialSubTab: 'ranks' },
          })
        }
      />
      <QuickAction
        icon={<Coins size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="Earn Points"
        onPress={() =>
          navigation.navigate('Earn', {
            screen: 'EarnHome',
            params: { initialSubTab: 'rewards' },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing['2xl'],
  },
});
