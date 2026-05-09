import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BookScreen from '@/screens/Book/BookScreen';
import BookingDetailScreen from '@/screens/Me/BookingDetailScreen';
import BookingsListScreen from '@/screens/Me/BookingsListScreen';
import ConnectHitTraxScreen from '@/screens/Me/ConnectHitTraxScreen';
import MeScreen from '@/screens/Me/MeScreen';
import OrdersListScreen from '@/screens/Me/OrdersListScreen';
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
        name="Book"
        component={BookScreen}
        options={{ title: 'Book a session' }}
      />
      <Stack.Screen
        name="BookingsList"
        component={BookingsListScreen}
        options={{ title: 'Bookings' }}
      />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{ title: 'Booking' }}
      />
      <Stack.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{ title: 'Orders' }}
      />
      <Stack.Screen
        name="ConnectHitTrax"
        component={ConnectHitTraxScreen}
        options={{ title: 'HitTrax' }}
      />
    </Stack.Navigator>
  );
}
