/**
 * MessagesInboxScreen — v0.7 task #120.
 *
 * One row per coach the parent has any thread with (or every coach in the
 * tenant if there are no messages yet). Tap a row to open the thread.
 */

import { useNavigation } from '@react-navigation/native';
import { Send } from 'lucide-react-native';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFamily } from '@/hooks/useFamily';
import { useParentInbox } from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Nav = WorkStackScreenProps<'MessagesInbox'>['navigation'];

export default function MessagesInboxScreen() {
  const navigation = useNavigation<Nav>();
  const { kids } = useFamily();
  const kid = kids[0] ?? null;
  const { data, isPending, isError, error, refetch, isFetching } = useParentInbox(kid?.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.darkest }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing['3xl'],
          paddingVertical: spacing['2xl'],
        }}
      >
        <Text
          style={{
            color: colors.gold,
            fontFamily: fontFamilies.oswaldBold,
            fontSize: fontSizes.xl,
            letterSpacing: tracking.wider,
          }}
        >
          MESSAGES
        </Text>
        <Pressable
          hitSlop={12}
          onPress={() => navigation.navigate('SendVideoToCoach', undefined)}
        >
          <Send size={20} color={colors.gold} />
        </Pressable>
      </View>

      {isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : isError ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] }}
        >
          <Text style={{ color: colors.danger, fontFamily: fontFamilies.interMedium }}>
            {errorMessage(error)}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(r) => r.coachUserId}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={colors.gold}
            />
          }
          contentContainerStyle={{ padding: spacing['3xl'], gap: spacing['2xl'] }}
          ListEmptyComponent={
            <Text
              style={{
                color: colors.textLight,
                fontFamily: fontFamilies.interRegular,
                fontSize: fontSizes.md,
                textAlign: 'center',
                marginTop: spacing['6xl'],
              }}
            >
              No coaches yet.
            </Text>
          }
          renderItem={({ item }) => {
            const name =
              [item.coachFirstName, item.coachLastName].filter(Boolean).join(' ') || 'Coach';
            const previewLine =
              !item.lastCreatedAt
                ? 'Tap to send a clip'
                : item.lastSenderIsSelf
                  ? `You sent ${item.lastHasVideo ? 'a video' : ''}${item.lastMessageText ? ` — ${item.lastMessageText}` : ''}`.trim()
                  : item.lastHasVideo
                    ? `Sent a video${item.lastMessageText ? ` — ${item.lastMessageText}` : ''}`
                    : (item.lastMessageText ?? 'Message');
            return (
              <Pressable
                onPress={() =>
                  kid &&
                  navigation.navigate('MessageThread', {
                    kidId: kid.id,
                    coachUserId: item.coachUserId,
                  })
                }
                style={({ pressed }) => [
                  {
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
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: colors.darker,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: colors.gold,
                      fontFamily: fontFamilies.oswaldBold,
                      fontSize: fontSizes.lg,
                    }}
                  >
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
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textOnDark,
                        fontFamily: fontFamilies.oswaldBold,
                        fontSize: fontSizes.lg,
                        letterSpacing: tracking.wide,
                      }}
                    >
                      {name.toUpperCase()}
                    </Text>
                    {item.unread ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colors.gold,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.textLight,
                      fontFamily: fontFamilies.interRegular,
                      fontSize: fontSizes.md,
                      marginTop: 2,
                    }}
                  >
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
