import { MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';

type Props = { locationName: string };

export default function HomeHeader({ locationName }: Props) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <View style={styles.locationRow}>
          <MapPin size={14} color={colors.gold} strokeWidth={2.5} />
          <Text style={styles.location}>{locationName}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginTop: spacing.xs,
  },
  location: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    letterSpacing: -0.5,
  },
});
