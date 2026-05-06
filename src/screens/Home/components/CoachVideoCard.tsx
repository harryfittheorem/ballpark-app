import { LinearGradient } from 'expo-linear-gradient';
import { Loader, Mail, Play } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  fontFamilies,
  fontSizes,
  radius,
  spacing,
  tracking,
} from '@/theme';

type Variant = 'ready' | 'processing' | 'empty';

type Props = {
  variant?: Variant;
  coachName?: string;
  thumbnail?: string;
  durationSeconds?: number;
  subtitle?: string;
  onPress?: () => void;
  /**
   * When true and variant === 'ready', renders a small gold "unread" dot
   * on the thumbnail. Ignored on the processing/empty variants since
   * there's no message to be unread on those.
   */
  unread?: boolean;
};

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function CoachVideoCard({
  variant = 'ready',
  coachName,
  thumbnail,
  durationSeconds,
  subtitle,
  onPress,
  unread = false,
}: Props) {
  const interactive = variant === 'ready' && !!onPress;

  return (
    <Pressable
      onPress={interactive ? onPress : undefined}
      disabled={!interactive}
      style={({ pressed }) => [styles.card, pressed && interactive && styles.pressed]}
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
        <View style={styles.iconWrap} pointerEvents="none">
          {variant === 'ready' ? (
            <Play size={22} color={colors.gold} fill={colors.gold} />
          ) : variant === 'processing' ? (
            <Loader size={22} color={colors.gold} />
          ) : (
            <Mail size={22} color={colors.gold} />
          )}
        </View>
        {variant === 'ready' && durationSeconds != null ? (
          <View style={styles.durationBadge} pointerEvents="none">
            <Text style={styles.durationText}>
              {formatDuration(durationSeconds)}
            </Text>
          </View>
        ) : null}
        {variant === 'ready' && unread ? (
          <View
            style={styles.unreadDot}
            pointerEvents="none"
            accessibilityLabel="Unread"
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>
          {variant === 'ready'
            ? "TODAY'S VIDEO"
            : variant === 'processing'
              ? 'NEW VIDEO'
              : 'COACH VIDEOS'}
        </Text>
        <Text
          style={styles.title}
          numberOfLines={variant === 'empty' ? 2 : 1}
        >
          {variant === 'ready'
            ? coachName ?? ''
            : variant === 'processing'
              ? 'Processing video…'
              : 'No coach videos yet — your coach will send one soon!'}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
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
  iconWrap: {
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
  unreadDot: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.darker,
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
  title: {
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
