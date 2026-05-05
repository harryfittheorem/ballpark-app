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
      style={({ pressed }) => [styles.shadow, pressed && styles.pressed]}
    >
      <View style={styles.card}>
        <View style={styles.goldEdge} pointerEvents="none" />

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
          <View style={styles.thumbOverlay} pointerEvents="none" />
          <View style={styles.playBadge} pointerEvents="none">
            <Play size={20} color={colors.dark} fill={colors.dark} />
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
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.85,
  },
  card: {
    borderRadius: radius['5xl'],
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  goldEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.gold,
  },
  thumbWrap: {
    aspectRatio: 16 / 9,
    width: '100%',
    backgroundColor: colors.dark,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 14, 14, 0.35)',
  },
  playBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radius.base,
    backgroundColor: 'rgba(15, 14, 14, 0.75)',
  },
  durationText: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textOnDark,
    letterSpacing: tracking.tight,
  },
  body: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  eyebrow: {
    fontFamily: fontFamilies.oswaldSemiBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
  },
  coachName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    marginTop: spacing.xs,
  },
});
