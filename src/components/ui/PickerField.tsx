import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

export type PickerMode = 'chips' | 'modal';

export interface PickerOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

export interface PickerFieldProps<T extends string | number> {
  label?: string;
  options: ReadonlyArray<PickerOption<T>>;
  value: T | null;
  onChange: (value: T | null) => void;

  mode?: PickerMode;
  allowClear?: boolean;
  placeholder?: string;

  /**
   * Called after every selection. Lets RHF `<Controller>` mark the field
   * touched on first interaction (chip pickers have no native blur event,
   * so we treat the selection itself as the touch signal).
   */
  onBlur?: () => void;

  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;

  testID?: string;
}

export function PickerField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  mode = 'chips',
  allowClear = true,
  onBlur,
  error,
  helperText,
  required,
  disabled = false,
  testID,
}: PickerFieldProps<T>) {
  if (mode === 'modal') {
    // Reserved API surface; implementation lands when v0.3 booking needs a
    // location/coach picker.
    throw new Error("PickerField mode='modal' not implemented");
  }

  return (
    <View style={styles.field} testID={testID}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.requiredMark}> *</Text> : null}
        </Text>
      ) : null}

      <View style={[styles.chipRow, disabled && styles.disabled]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={String(option.value)}
              onPress={() => {
                if (disabled) return;
                if (selected && allowClear) {
                  onChange(null);
                } else {
                  onChange(option.value);
                }
                onBlur?.();
              }}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing['3xl'] },
  label: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  requiredMark: {
    color: colors.danger,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.base,
  },
  disabled: {
    opacity: 0.5,
  },
  chip: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  chipSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
  },
  chipTextSelected: {
    color: colors.darkest,
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
