/**
 * One row in the coach Sent Videos list.
 *
 * Visual: Mux poster thumbnail (or "Processing…" placeholder while the asset
 * isn't ready), recipient kid name + family line, relative sent time, and a
 * "Viewed" / "Sent" badge driven by `viewedAt`.
 *
 * Press: when the Mux asset is `ready`, navigates to CoachVideoPlayback
 * so the coach can review what they sent. Coaches do NOT mark messages
 * viewed — that field is parent-only telemetry. Rows that are still
 * processing or errored are non-tappable (the press is swallowed) so we
 * don't open a black player on a missing playback id.
 */

import { useNavigation } from '@react-navigation/native';
import { Image, Pressable, Text, View } from 'react-native';

import type { SentCoachMessageRow } from '@/api/coachMessages';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { formatRelativeTime } from '@/utils/time';

import { styles } from '../styles';

type Nav = CoachInboxStackScreenProps<'SentVideos'>['navigation'];

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
  const navigation = useNavigation<Nav>();
  const recipient = `${message.kidFirstName} ${message.kidLastName}`.trim();
  const familyLine = message.familyLastName
    ? `${message.familyLastName} Family`
    : '';
  const sent = formatRelativeTime(message.createdAt);
  const viewed = message.viewedAt != null;
  const playable =
    message.videoStatus === 'ready' && !!message.muxPlaybackId;
  const showPoster = playable;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Video sent to ${recipient}, ${viewed ? 'viewed' : 'not yet viewed'}`}
      accessibilityState={{ disabled: !playable }}
      disabled={!playable}
      style={({ pressed }) => [styles.row, pressed && playable && styles.rowPressed]}
      onPress={() => {
        if (!playable) return;
        navigation.navigate('CoachVideoPlayback', {
          playbackId: message.muxPlaybackId as string,
        });
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
