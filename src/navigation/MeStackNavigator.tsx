import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddKidScreen from '@/screens/Auth/AddKidScreen';
import BookingDetailScreen from '@/screens/Me/BookingDetailScreen';
import EditKidScreen from '@/screens/Me/EditKidScreen';
import BookingsListScreen from '@/screens/Me/BookingsListScreen';
import ConnectHitTraxScreen from '@/screens/Me/ConnectHitTraxScreen';
import CreateHitTraxAccountScreen from '@/screens/Me/CreateHitTraxAccountScreen';
import KioskScanScreen from '@/screens/Me/KioskScanScreen';
import MembershipDetailsScreen from '@/screens/Me/MembershipDetailsScreen';
import OrdersListScreen from '@/screens/Me/OrdersListScreen';
import PaymentMethodScreen from '@/screens/Me/PaymentMethodScreen';
import ProfileScreen from '@/screens/Me/ProfileScreen';
import FamilyCoachingScreen from '@/screens/Me/FamilyCoachingScreen';
import UpgradeMembershipScreen from '@/screens/Me/UpgradeMembershipScreen';
import WaitlistClaimScreen from '@/screens/Me/WaitlistClaimScreen';
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
      <Stack.Screen name="FamilyCoaching" component={FamilyCoachingScreen} options={{ title: 'Progress & lessons' }} />
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
        name="WaitlistClaim"
        component={WaitlistClaimScreen}
        options={{ title: 'Claim Spot' }}
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
        name="CreateHitTraxAccount"
        component={CreateHitTraxAccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="KioskScan"
        component={KioskScanScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PaymentMethod"
        component={PaymentMethodScreen}
        options={{ title: 'Payment Method' }}
      />
      <Stack.Screen
        name="MembershipDetails"
        component={MembershipDetailsScreen}
        options={{ title: 'Membership' }}
      />
      <Stack.Screen
        name="UpgradeMembership"
        component={UpgradeMembershipScreen}
        options={{ title: 'Upgrade Plan' }}
      />
      <Stack.Screen
        name="AddKid"
        component={AddKidScreen}
        options={{ title: 'Add Athlete', headerShown: false }}
      />
      <Stack.Screen
        name="EditKid"
        component={EditKidScreen}
        options={{ title: 'Edit Athlete' }}
      />
    </Stack.Navigator>
  );
}
