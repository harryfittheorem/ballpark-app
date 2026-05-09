import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  kidFirstName: string;
  unreadCount?: number;
  onPressBell?: () => void;
};

export default function HomeHeader({ kidFirstName, unreadCount = 0, onPressBell }: Props) {
  return (
    <View style={styles.container}>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>HEY, CHAMP</Text>
        <Text style={styles.greeting} numberOfLines={1}>
          {kidFirstName.toUpperCase()}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Notifications"
        onPress={onPressBell}
        style={styles.bell}
      >
        <Bell size={20} color={colors.gold} strokeWidth={2.5} />
        {unreadCount > 0 ? <View style={styles.badge} /> : null}
      </Pressable>
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
  badge: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
});
