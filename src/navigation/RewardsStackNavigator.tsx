/**
 * Rewards tab stack — task #119.
 *
 * Replaces the old EarnStackNavigator. The Rewards screen wraps the
 * existing Rewards / Store / Earn-rules tab components behind a
 * SubTabBar; Ranks has been promoted to its own bottom tab.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RewardsScreen from '@/screens/Rewards/RewardsScreen';
import RewardRedeemScreen from '@/screens/Earn/RewardRedeemScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { RewardsStackParamList } from './types';

const Stack = createNativeStackNavigator<RewardsStackParamList>();

export default function RewardsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.darkest },
        headerTintColor: colors.gold,
        headerTitleStyle: {
          fontFamily: fontFamilies.oswaldBold,
          fontSize: fontSizes.xl,
        },
        contentStyle: { backgroundColor: colors.darkest },
      }}
    >
      <Stack.Screen name="RewardsHome" component={RewardsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="RewardRedeem"
        component={RewardRedeemScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
