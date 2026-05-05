import * as Haptics from 'expo-haptics';
import { ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
};

export default function QuickAction({ icon, label, onPress }: Props) {
  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.circle}>{icon}</View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: spacing.base,
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textOnDark,
    letterSpacing: tracking.wide,
    textAlign: 'center',
  },
});
