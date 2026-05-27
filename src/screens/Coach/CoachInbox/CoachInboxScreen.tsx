/**
 * CoachInboxScreen — coach-facing message thread list.
 *
 * One row per family the coach has exchanged messages with, showing the
 * last message preview and an unread dot for unread parent replies.
 * Tap a row to open CoachMessageThreadScreen. Back arrow returns to the
 * coach home screen (CoachHomeScreen / InboxHome).
 *
 * Empty state: "No messages yet." appears until the first message is sent.
 */

import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCoachInbox } from '@/hooks/useCoachInbox';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = CoachInboxStackScreenProps<'CoachInboxHome'>['navigation'];

function formatRelative(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CoachInboxScreen() {
  const navigation = useNavigation<Nav>();
  const { data, isPending, isError, error, refetch, isFetching } = useCoachInbox();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.headerTitle}>INBOX</Text>
        {/* Spacer keeps title visually centred */}
        <View style={{ width: 22 }} />
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage(error)}</Text>
          <Pressable onPress={() => refetch()} style={styles.retryBtn} hitSlop={12}>
            <Text style={styles.retryText}>RETRY</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.familyId}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No messages yet.</Text>
          }
          renderItem={({ item }) => {
            const familyName = item.familyLastName
              ? `${item.kidFirstName} ${item.familyLastName}`
              : item.kidFirstName;
            const initials = [item.kidFirstName, item.familyLastName]
              .filter(Boolean)
              .map((s) => s[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            const previewLine = !item.lastCreatedAt
              ? 'No messages yet'
              : item.lastHasVideo
                ? item.unread
                  ? 'Family sent a video'
                  : 'You sent a video'
                : (item.lastMessageText ?? 'Message');

            return (
              <Pressable
                onPress={() =>
                  navigation.navigate('CoachMessageThread', {
                    kidId: item.kidId,
                    coachUserId: item.coachUserId,
                    familyDisplayName: familyName,
                  })
                }
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials || '?'}</Text>
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.rowTop}>
                    <Text style={styles.familyName} numberOfLines={1}>
                      {familyName.toUpperCase()}
                    </Text>
                    <View style={styles.rowMeta}>
                      {item.unread && <View style={styles.unreadDot} />}
                      {!!item.lastCreatedAt && (
                        <Text style={styles.timestamp}>
                          {formatRelative(item.lastCreatedAt)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text numberOfLines={1} style={[styles.preview, item.unread && styles.previewUnread]}>
                    {previewLine}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    letterSpacing: tracking.wider,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: spacing['2xl'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  retryBtn: { marginTop: spacing['2xl'] },
  retryText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    letterSpacing: tracking.wide,
  },
  list: {
    padding: spacing['3xl'],
    gap: spacing['2xl'],
  },
  emptyText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
    marginTop: spacing['6xl'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2xl'],
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['3xl'],
    backgroundColor: colors.dark,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.borderGold,
  },
  rowPressed: { opacity: 0.85 },
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
  rowContent: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  familyName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    letterSpacing: tracking.wide,
    flexShrink: 1,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    flexShrink: 0,
    marginLeft: spacing.base,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  timestamp: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
  },
  preview: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  previewUnread: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interMedium,
  },
});
