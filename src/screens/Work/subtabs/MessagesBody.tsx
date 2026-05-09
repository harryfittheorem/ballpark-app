/**
 * Messages sub-tab body for the Work tab — task #135.
 *
 * Shows a coach-video rail (latest coach->parent messages) at the top
 * with a "send a clip" CTA, and the per-coach inbox folded below.
 */

import { useNavigation } from '@react-navigation/native';
import { Inbox, Mail, Send } from 'lucide-react-native';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCoachMessagesForKid } from '@/hooks/useCoachMessages';
import { useFamily } from '@/hooks/useFamily';
import { useParentInbox } from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import EmptyState from '@/screens/Videos/components/EmptyState';
import CoachVideoCard from '@/screens/Home/components/CoachVideoCard';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { formatRelativeTime } from '@/utils/time';

type Nav = WorkStackScreenProps<'WorkHome'>['navigation'];

const POSTER_WIDTH = 480;
function muxPoster(playbackId: string) {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=${POSTER_WIDTH}`;
}

export default function MessagesBody() {
  const navigation = useNavigation<Nav>();
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  const { data: messages } = useCoachMessagesForKid(kid?.id);
  const { data: inbox, isPending: inboxPending, refetch, isFetching } = useParentInbox(kid?.id);

  const onSend = () => navigation.navigate('SendVideoToCoach', undefined);
  const onPlayCoachVideo = (messageId: string) =>
    navigation.navigate('Home', { screen: 'VideoPlayback', params: { messageId } });
  const onOpenThread = (coachUserId: string) =>
    kid && navigation.navigate('MessageThread', { kidId: kid.id, coachUserId });

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={isFetching}
          onRefresh={refetch}
          tintColor={colors.gold}
        />
      }
    >
      <View style={styles.ctaRow}>
        <Pressable
          onPress={onSend}
          style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel="Send a video to coach"
        >
          <Send size={18} color={colors.dark} />
          <Text style={styles.primaryCtaText}>SEND A VIDEO TO COACH</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>FROM COACH</Text>
      {(messages ?? []).length === 0 ? (
        <EmptyState
          icon={<Mail size={22} color={colors.gold} />}
          title="No coach messages yet"
          body="When a coach sends a video it lands here and on Home."
        />
      ) : (
        (messages ?? []).map((m) => {
          const v = m.video;
          const ready = v && v.status === 'ready' && v.muxPlaybackId;
          const coachName = m.coach
            ? `${m.coach.firstName} ${m.coach.lastName}`.trim()
            : 'Your coach';
          return (
            <View key={m.id} style={styles.coachVideoWrap}>
              <CoachVideoCard
                variant={ready ? 'ready' : 'processing'}
                coachName={coachName}
                thumbnail={ready ? muxPoster(v!.muxPlaybackId as string) : undefined}
                durationSeconds={v?.durationSeconds ?? undefined}
                subtitle={formatRelativeTime(m.createdAt)}
                unread={!m.viewedAt}
                onPress={ready ? () => onPlayCoachVideo(m.id) : undefined}
              />
            </View>
          );
        })
      )}

      <Text style={styles.sectionLabel}>COACHES</Text>
      {inboxPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (inbox ?? []).length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} color={colors.gold} />}
          title="No coaches yet"
          body="Once your facility adds a coach they'll appear here."
        />
      ) : (
        (inbox ?? []).map((row) => {
          const name =
            [row.coachFirstName, row.coachLastName].filter(Boolean).join(' ') || 'Coach';
          const previewLine =
            !row.lastCreatedAt
              ? 'Tap to send a clip'
              : row.lastSenderIsSelf
                ? `You sent ${row.lastHasVideo ? 'a video' : ''}${row.lastMessageText ? ` — ${row.lastMessageText}` : ''}`.trim()
                : row.lastHasVideo
                  ? `Sent a video${row.lastMessageText ? ` — ${row.lastMessageText}` : ''}`
                  : (row.lastMessageText ?? 'Message');
          return (
            <Pressable
              key={row.coachUserId}
              onPress={() => onOpenThread(row.coachUserId)}
              style={({ pressed }) => [styles.inboxRow, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {name
                    .split(' ')
                    .map((s) => s[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.inboxHeader}>
                  <Text style={styles.inboxName}>{name.toUpperCase()}</Text>
                  {row.unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text numberOfLines={1} style={styles.inboxPreview}>
                  {previewLine}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['6xl'] },
  ctaRow: { gap: spacing.lg, marginBottom: spacing['2xl'] },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    backgroundColor: colors.gold,
    paddingVertical: spacing['3xl'],
    borderRadius: radius['2xl'],
  },
  primaryCtaText: {
    color: colors.dark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wider,
  },
  sectionLabel: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wider,
    marginTop: spacing['3xl'],
    marginBottom: spacing.lg,
  },
  coachVideoWrap: { marginBottom: spacing['2xl'] },
  centered: { padding: spacing['4xl'], alignItems: 'center' },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.dark,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.darker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
  },
  inboxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inboxName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
  },
  inboxPreview: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: 2,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
});
