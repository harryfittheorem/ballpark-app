import { Calendar, Flame, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import StatTile from './StatTile';

type Props = {
  pointsBalance: number;
  currentStreakDays: number;
};

export default function StatTilesRow({ pointsBalance, currentStreakDays }: Props) {
  // TODO(v0.3): wire to real session count
  const sessionsThisWeek = 0;

  return (
    <View style={styles.row}>
      <StatTile
        label="SESSIONS THIS WEEK"
        value={sessionsThisWeek}
        icon={<Calendar size={12} color={colors.textLight} />}
      />
      <StatTile
        label="POINTS EARNED"
        value={pointsBalance}
        accent="gold"
        icon={<Trophy size={12} color={colors.gold} />}
      />
      <StatTile
        label="STREAK DAYS"
        value={currentStreakDays}
        accent="gold"
        icon={<Flame size={12} color={colors.gold} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
