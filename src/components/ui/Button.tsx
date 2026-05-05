import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonTone = 'gold' | 'muted' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;

  variant?: ButtonVariant;
  size?: ButtonSize;
  tone?: ButtonTone;

  loading?: boolean;
  disabled?: boolean;

  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;

  testID?: string;
  accessibilityLabel?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  tone = 'gold',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = true,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    if (variant === 'primary' || variant === 'secondary') {
      // Fire-and-forget; never block onPress on haptic feedback.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    sizeStyles[size].container,
    variantContainerStyle(variant),
    fullWidth && styles.fullWidth,
    isDisabled && styles.disabled,
  ];

  const textStyle: StyleProp<TextStyle> = [
    sizeStyles[size].text,
    variantTextStyle(variant, tone),
  ];

  const spinnerColor = variantSpinnerColor(variant, tone);

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <Text style={textStyle}>{label}</Text>
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function variantContainerStyle(variant: ButtonVariant): ViewStyle {
  if (variant === 'primary') {
    return {
      backgroundColor: colors.gold,
      borderRadius: radius.xl,
    };
  }
  if (variant === 'secondary') {
    return {
      backgroundColor: colors.darker,
      borderColor: colors.gold,
      borderWidth: 1,
      borderRadius: radius.xl,
    };
  }
  // tertiary
  return {
    backgroundColor: 'transparent',
    borderRadius: radius.md,
  };
}

function variantTextStyle(variant: ButtonVariant, tone: ButtonTone): TextStyle {
  if (variant === 'primary') {
    return {
      color: colors.dark,
      fontFamily: fontFamilies.oswaldBold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    };
  }
  if (variant === 'secondary') {
    return {
      color: colors.gold,
      fontFamily: fontFamilies.oswaldBold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    };
  }
  // tertiary — tone-driven, no uppercase (used for links + sign-out)
  return {
    color: toneColor(tone),
    fontFamily: fontFamilies.interMedium,
  };
}

function variantSpinnerColor(variant: ButtonVariant, tone: ButtonTone): string {
  if (variant === 'primary') return colors.dark;
  if (variant === 'secondary') return colors.gold;
  return toneColor(tone);
}

function toneColor(tone: ButtonTone): string {
  if (tone === 'muted') return colors.textMuted;
  if (tone === 'danger') return colors.danger;
  return colors.gold;
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: { paddingVertical: spacing.lg, paddingHorizontal: spacing['3xl'] },
    text: { fontSize: fontSizes.md },
  },
  md: {
    container: { paddingVertical: spacing['3xl'], paddingHorizontal: spacing['3xl'] },
    text: { fontSize: fontSizes.lg },
  },
  lg: {
    container: { paddingVertical: spacing['4xl'], paddingHorizontal: spacing['3xl'] },
    text: { fontSize: fontSizes.xl },
  },
};
