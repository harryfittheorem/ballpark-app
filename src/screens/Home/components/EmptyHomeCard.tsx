import { LinearGradient } from 'expo-linear-gradient';
import { UserPlus } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  onAddKid: () => void;
};

export default function EmptyHomeCard({ onAddKid }: Props) {
  return (
    <View style={styles.shadow}>
      <LinearGradient
        colors={[colors.gold, colors.goldBright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.innerBorder} pointerEvents="none" />
        <View style={styles.iconCircle}>
          <UserPlus size={28} color={colors.dark} />
        </View>
        <Text style={styles.title}>WELCOME TO BALLPARK</Text>
        <Text style={styles.subtitle}>
          Add your kid to start booking sessions, earning points, and watching
          videos from their coach.
        </Text>
        <View style={styles.buttonWrap}>
          <Button
            label="Add your kid"
            onPress={onAddKid}
            testID="empty-home-add-kid"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: colors.darkest,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: radius['5xl'],
  },
  card: {
    borderRadius: radius['5xl'],
    padding: spacing['3xl'],
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius['5xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  iconCircle: {
    width: spacing['5xl'],
    height: spacing['5xl'],
    borderRadius: spacing['5xl'] / 2,
    backgroundColor: 'rgba(15, 14, 14, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.dark,
    letterSpacing: tracking.tight,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.base,
    color: colors.dark,
    opacity: 0.78,
    marginTop: spacing.sm,
  },
  buttonWrap: {
    alignSelf: 'stretch',
    marginTop: spacing['2xl'],
  },
});
