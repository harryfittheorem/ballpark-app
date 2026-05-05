import { CalendarClock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  upcomingCount: number;
};

export default function BookingsStatRow({ upcomingCount }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <CalendarClock size={18} color={colors.gold} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label}>UPCOMING BOOKINGS</Text>
        <Text style={styles.value}>
          {upcomingCount} this week
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    borderRadius: radius['2xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  label: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  value: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    marginTop: spacing.xxs,
  },
});
