import { StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';

import { colors, radius } from '@/theme';

interface CircleBackButtonProps {
  onPress: () => void;
}

export default function CircleBackButton({ onPress }: CircleBackButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.circle}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <ChevronLeft size={20} color={colors.gold} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
