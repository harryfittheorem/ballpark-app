import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EarnScreen from '@/screens/Earn/EarnScreen';
import RewardRedeemScreen from '@/screens/Earn/RewardRedeemScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { EarnStackParamList } from './types';

const Stack = createNativeStackNavigator<EarnStackParamList>();

export default function EarnStackNavigator() {
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
      <Stack.Screen name="EarnHome" component={EarnScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="RewardRedeem"
        component={RewardRedeemScreen}
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
