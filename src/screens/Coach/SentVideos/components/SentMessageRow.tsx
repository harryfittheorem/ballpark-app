/**
 * One row in the coach Sent Videos list.
 *
 * Visual: Mux poster thumbnail (or "Processing…" placeholder while the asset
 * isn't ready), recipient kid name + family line, relative sent time, and a
 * "Viewed" / "Sent" badge driven by `viewedAt`.
 *
 * Press is a deliberate no-op for now — the playback / detail screen for a
 * sent message is future work (PRD v0.6). We still render as a Pressable so
 * the row gives tactile feedback and is ready to wire up later without a
 * markup churn.
 */

import { Image, Pressable, Text, View } from 'react-native';

import type { SentCoachMessageRow } from '@/api/coachMessages';
import { formatRelativeTime } from '@/utils/time';

import { styles } from '../styles';

const POSTER_WIDTH = 240;

function muxPosterUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type Props = {
  message: SentCoachMessageRow;
};

export default function SentMessageRow({ message }: Props) {
  const recipient = `${message.kidFirstName} ${message.kidLastName}`.trim();
  const familyLine = message.familyLastName
    ? `${message.familyLastName} Family`
    : '';
  const sent = formatRelativeTime(message.createdAt);
  const viewed = message.viewedAt != null;
  const showPoster =
    message.videoStatus === 'ready' && !!message.muxPlaybackId;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Video sent to ${recipient}, ${viewed ? 'viewed' : 'not yet viewed'}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => {
        // Detail screen is future work — intentional no-op for now.
      }}
    >
      <View style={styles.thumbWrap}>
        {showPoster ? (
          <Image
            source={{ uri: muxPosterUrl(message.muxPlaybackId as string) }}
            style={styles.thumbImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={styles.thumbProcessingText} numberOfLines={2}>
            {message.videoStatus === 'errored' ? 'Failed' : 'Processing…'}
          </Text>
        )}
        {message.durationSeconds != null ? (
          <View style={styles.durationBadge} pointerEvents="none">
            <Text style={styles.durationText}>
              {formatDuration(message.durationSeconds)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.recipientName} numberOfLines={1}>
          {recipient}
        </Text>
        {familyLine ? (
          <Text style={styles.familyLine} numberOfLines={1}>
            {familyLine}
          </Text>
        ) : null}
        <View style={styles.rowFooter}>
          <Text style={styles.sentTime}>{sent}</Text>
          <View style={[styles.badge, viewed ? styles.badgeViewed : styles.badgeSent]}>
            <Text
              style={[
                styles.badgeText,
                viewed ? styles.badgeTextViewed : styles.badgeTextSent,
              ]}
            >
              {viewed ? 'Viewed' : 'Sent'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
