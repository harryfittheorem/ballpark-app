import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  kidFirstName: string;
};

export default function HomeHeader({ kidFirstName }: Props) {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>WELCOME BACK</Text>
        <Text style={styles.greeting} numberOfLines={1}>
          {kidFirstName.toUpperCase()}
        </Text>
      </View>
      <View style={styles.bell} accessible={false} importantForAccessibility="no">
        <Bell size={20} color={colors.gold} strokeWidth={2.5} />
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
    alignItems: 'center',
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
  },
  greeting: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
