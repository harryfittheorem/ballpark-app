import { createNativeStackNavigator } from '@react-navigation/native-stack';

import BookingDetailScreen from '@/screens/Me/BookingDetailScreen';
import BookingsListScreen from '@/screens/Me/BookingsListScreen';
import CancelMembershipScreen from '@/screens/Me/CancelMembershipScreen';
import ChangeLocationScreen from '@/screens/Me/ChangeLocationScreen';
import ConnectHitTraxScreen from '@/screens/Me/ConnectHitTraxScreen';
import OrdersListScreen from '@/screens/Me/OrdersListScreen';
import PaymentMethodScreen from '@/screens/Me/PaymentMethodScreen';
import ProfileScreen from '@/screens/Me/ProfileScreen';
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
      <Stack.Screen name="MeHome" component={ProfileScreen} options={{ headerShown: false }} />
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
      <Stack.Screen
        name="PaymentMethod"
        component={PaymentMethodScreen}
        options={{ title: 'Payment Method' }}
      />
      <Stack.Screen
        name="ChangeLocation"
        component={ChangeLocationScreen}
        options={{ title: 'My Location' }}
      />
      <Stack.Screen
        name="CancelMembership"
        component={CancelMembershipScreen}
        options={{ title: 'Cancel Membership' }}
      />
    </Stack.Navigator>
  );
}
