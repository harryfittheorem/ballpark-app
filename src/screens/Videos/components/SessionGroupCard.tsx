/**
 * SessionGroupCard — one row in the Videos → Swings (BY SESSION) list.
 * Tapping pushes SessionDetail. Header shows the session date + headline
 * stats; below it a horizontal preview strip of the first few swings.
 */

import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Session } from '@/api/sessions';
import type { Swing } from '@/api/swings';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import SwingThumbnail from './SwingThumbnail';

type Props = {
  session: Session;
  previewSwings: Swing[];
  favorites: Set<string>;
  onPressSession: () => void;
  onPressSwing: (swingId: string) => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SessionGroupCard({
  session,
  previewSwings,
  favorites,
  onPressSession,
  onPressSwing,
}: Props) {
  const top = previewSwings.slice(0, 3);
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPressSession}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.date}>{formatDate(session.started_at).toUpperCase()}</Text>
          <Text style={styles.subtitle}>
            {formatTime(session.started_at)} · {session.swing_count ?? 0} swings
            {session.best_exit_velocity_mph != null
              ? `  ·  TOP ${Number(session.best_exit_velocity_mph).toFixed(1)} MPH`
              : ''}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.textLight} />
      </Pressable>
      {top.length > 0 ? (
        <View style={styles.previewRow}>
          {top.map((s) => (
            <View key={s.id} style={styles.previewCell}>
              <SwingThumbnail
                swing={s}
                favorited={favorites.has(s.id)}
                onPress={() => onPressSwing(s.id)}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.darker,
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing['2xl'],
    marginBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
  },
  pressed: { opacity: 0.85 },
  date: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wide,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginTop: spacing.xxs,
    letterSpacing: tracking.wide,
  },
  previewRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  previewCell: { flex: 1 },
});
