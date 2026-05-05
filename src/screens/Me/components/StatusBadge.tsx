import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = { status: string };

type BadgeStyle = { bg: string; fg: string; label: string };

function styleForStatus(status: string): BadgeStyle {
  switch (status) {
    case 'confirmed':
      return { bg: colors.successBg, fg: colors.success, label: 'Confirmed' };
    case 'completed':
      return { bg: colors.infoBg, fg: colors.info, label: 'Completed' };
    case 'cancelled':
      return { bg: colors.dangerBg, fg: colors.danger, label: 'Cancelled' };
    case 'pending':
      return { bg: colors.warningBg, fg: colors.warning, label: 'Pending' };
    case 'no_show':
      return { bg: colors.dangerBg, fg: colors.danger, label: 'No-show' };
    default:
      return { bg: colors.border, fg: colors.textLight, label: status };
  }
}

export default function StatusBadge({ status }: Props) {
  const s = styleForStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  text: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.xs,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
});
