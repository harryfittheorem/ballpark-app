import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Props = {
  coachName: string;
  thumbnail?: string;
  durationSeconds?: number;
  onPress?: () => void;
};

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function CoachVideoCard({
  coachName,
  thumbnail,
  durationSeconds,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbWrap}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbImage} />
        ) : (
          <LinearGradient
            colors={[colors.dark, colors.darker]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.playIconWrap} pointerEvents="none">
          <Play size={22} color={colors.gold} fill={colors.gold} />
        </View>
        {durationSeconds != null ? (
          <View style={styles.durationBadge} pointerEvents="none">
            <Text style={styles.durationText}>
              {formatDuration(durationSeconds)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>TODAY&apos;S VIDEO</Text>
        <Text style={styles.coachName} numberOfLines={1}>
          {coachName}
        </Text>
      </View>
    </Pressable>
  );
}

const THUMB_WIDTH = spacing['7xl'] + spacing['5xl'];

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius['3xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  pressed: {
    opacity: 0.85,
  },
  thumbWrap: {
    width: THUMB_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: colors.gold,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  playIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(15, 14, 14, 0.75)',
  },
  durationText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xs,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  coachName: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    marginTop: spacing.xs,
  },
});
