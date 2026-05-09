import { useNavigation } from '@react-navigation/native';
import { Calendar, Coins, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { HomeStackScreenProps } from '@/navigation/types';
import { spacing } from '@/theme';

import QuickAction from './QuickAction';

const ICON_SIZE = 24;

type Nav = HomeStackScreenProps<'HomeMain'>['navigation'];

export default function QuickActionsRow() {
  // v0.7 task #119: Book moved out of the bottom tab into a Me sub-screen,
  // so the on-Home Quick Action is now the primary entry point. We jump
  // through the parent tab navigator → Me tab → Book route. View Leaderboard
  // → Ranks (its own tab now). Earn Points → Rewards → Earn-rules sub-tab.
  const navigation = useNavigation<Nav>();
  return (
    <View style={styles.row}>
      <QuickAction
        icon={<Calendar size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="Book Session"
        onPress={() => navigation.navigate('Me', { screen: 'Book' })}
      />
      <QuickAction
        icon={<Trophy size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="View Leaderboard"
        onPress={() => navigation.navigate('Ranks')}
      />
      <QuickAction
        icon={<Coins size={ICON_SIZE} color="#F1E5AD" strokeWidth={2} />}
        label="Earn Points"
        onPress={() => navigation.navigate('Rewards', { screen: 'RewardsHome' })}
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
