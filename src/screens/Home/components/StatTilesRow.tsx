import { Flame, Trophy, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import StatTile from './StatTile';

type Props = {
  currentStreakDays: number;
  rank: number | null;
  exitVeloMph: number | null;
};

export default function StatTilesRow({ currentStreakDays, rank, exitVeloMph }: Props) {
  return (
    <View style={styles.row}>
      <StatTile
        label="STREAK"
        value={currentStreakDays}
        accent="gold"
        icon={<Flame size={12} color={colors.gold} />}
      />
      <StatTile
        label="RANK"
        value={rank != null ? `#${rank}` : '—'}
        accent="gold"
        icon={<Trophy size={12} color={colors.gold} />}
      />
      <StatTile
        label="EXIT VELO"
        value={exitVeloMph != null ? `${Math.round(exitVeloMph)}` : '—'}
        accent="gold"
        icon={<Zap size={12} color={colors.gold} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.base,
  },
});
