/**
 * Determinate progress bar with percentage label and an optional cancel
 * button. Pure presentational — no upload logic lives here so it can be
 * dropped straight into the Step 4.9 send flow without changes.
 */

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

export type UploadProgressProps = {
  /** Fraction in [0, 1]. Values outside the range are clamped. */
  progress: number;
  onCancel?: () => void;
  cancelLabel?: string;
};

export default function UploadProgress({
  progress,
  onCancel,
  cancelLabel = 'Cancel',
}: UploadProgressProps) {
  const fraction = Math.min(1, Math.max(0, progress));
  const percent = Math.round(fraction * 100);
  return (
    <View>
      <View style={styles.row}>
        <Text style={styles.label}>Uploading</Text>
        <Text style={styles.percent}>{percent}%</Text>
      </View>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
      >
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      {onCancel ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={styles.cancelBtn}
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  label: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  percent: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.gold,
  },
  track: {
    height: 10,
    backgroundColor: colors.darker,
    borderRadius: radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.gold,
  },
  cancelBtn: {
    alignSelf: 'center',
    marginTop: spacing['3xl'],
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
  },
  cancelText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },
});
