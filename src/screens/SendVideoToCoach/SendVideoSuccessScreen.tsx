import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, MessageCircle } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Nav = VideosStackScreenProps<'SendVideoSuccess'>['navigation'];
type Route = VideosStackScreenProps<'SendVideoSuccess'>['route'];

export default function SendVideoSuccessScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { coachUserId, kidId } = route.params;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.darkest }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing['3xl'],
          gap: spacing['3xl'],
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.gold,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={40} color={colors.dark} strokeWidth={3} />
        </View>
        <Text
          style={{
            color: colors.textOnDark,
            fontFamily: fontFamilies.oswaldBold,
            fontSize: fontSizes['3xl'],
            letterSpacing: tracking.wider,
          }}
        >
          SENT
        </Text>
        <Text
          style={{
            color: colors.textLight,
            fontFamily: fontFamilies.interRegular,
            fontSize: fontSizes.lg,
            textAlign: 'center',
            paddingHorizontal: spacing['4xl'],
          }}
        >
          Your coach gets a push notification and an inbox card. The clip
          finishes processing in a minute or two.
        </Text>
        <View style={{ width: '100%', gap: spacing['2xl'] }}>
          <Pressable
            onPress={() =>
              navigation.replace('MessageThread', { kidId, coachUserId })
            }
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.base,
                backgroundColor: colors.gold,
                paddingVertical: spacing['3xl'],
                borderRadius: radius['2xl'],
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <MessageCircle size={18} color={colors.dark} />
            <Text
              style={{
                color: colors.dark,
                fontFamily: fontFamilies.oswaldBold,
                fontSize: fontSizes.lg,
                letterSpacing: tracking.wider,
              }}
            >
              VIEW THREAD
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.popToTop()}
            style={({ pressed }) => [
              {
                paddingVertical: spacing['3xl'],
                borderRadius: radius['2xl'],
                borderWidth: 1,
                borderColor: colors.borderGold,
                alignItems: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text
              style={{
                color: colors.gold,
                fontFamily: fontFamilies.oswaldBold,
                fontSize: fontSizes.lg,
                letterSpacing: tracking.wider,
              }}
            >
              DONE
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
