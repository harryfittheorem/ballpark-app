import { forwardRef, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export interface InputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;

  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  keyboardType?: TextInputProps['keyboardType'];
  textContentType?: TextInputProps['textContentType'];
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onBlur?: TextInputProps['onBlur'];
  onFocus?: TextInputProps['onFocus'];
  editable?: boolean;
  maxLength?: number;
  multiline?: boolean;

  error?: string;
  helperText?: string;
  required?: boolean;

  leftIcon?: ReactNode;
  rightIcon?: ReactNode;

  testID?: string;
  accessibilityLabel?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    autoCapitalize,
    autoComplete,
    keyboardType,
    textContentType,
    returnKeyType,
    onSubmitEditing,
    onBlur,
    onFocus,
    editable = true,
    maxLength,
    multiline = false,
    error,
    helperText,
    required,
    leftIcon,
    rightIcon,
    testID,
    accessibilityLabel,
  },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.gold
      : colors.border;

  return (
    <View style={styles.field}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          { borderColor },
          !editable && styles.inputDisabled,
        ]}
      >
        {leftIcon ? <View style={styles.adornment}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          editable={editable}
          maxLength={maxLength}
          multiline={multiline}
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label}
        />
        {rightIcon ? <View style={styles.adornment}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { marginBottom: spacing['3xl'] },
  label: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  requiredMark: {
    color: colors.danger,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['3xl'],
  },
  inputDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    paddingVertical: spacing['2xl'],
  },
  inputMultiline: {
    // ~4 lines at the body line-height; matches DESIGN.md textarea guidance.
    minHeight: spacing['7xl'] * 2,
    textAlignVertical: 'top',
  },
  adornment: {
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
  helperText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.sm,
  },
});
