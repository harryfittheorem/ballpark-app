import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BookingsListScreen from '@/screens/Me/BookingsListScreen';
import MeScreen from '@/screens/Me/MeScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { MeStackParamList } from './types';

const Stack = createNativeStackNavigator<MeStackParamList>();

export default function MeStackNavigator() {
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
      <Stack.Screen name="MeHome" component={MeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="BookingsList"
        component={BookingsListScreen}
        options={{ title: 'Bookings' }}
      />
    </Stack.Navigator>
  );
}
