import { Calendar, Coins, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import QuickAction from './QuickAction';

const ICON_SIZE = 24;

export default function QuickActionsRow() {
  return (
    <View style={styles.row}>
      <QuickAction
        icon={<Calendar size={ICON_SIZE} color={colors.gold} strokeWidth={2} />}
        label="Book Session"
        onPress={() => {}}
      />
      <QuickAction
        icon={<Trophy size={ICON_SIZE} color={colors.gold} strokeWidth={2} />}
        label="View Leaderboard"
        onPress={() => {}}
      />
      <QuickAction
        icon={<Coins size={ICON_SIZE} color={colors.gold} strokeWidth={2} />}
        label="Earn Points"
        onPress={() => {}}
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
