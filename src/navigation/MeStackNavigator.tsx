import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddKidModalScreen from '@/screens/Me/AddKidModalScreen';
import EditKidScreen from '@/screens/Me/EditKidScreen';
import MeScreen from '@/screens/Me/MeScreen';

import type { MeStackParamList } from './types';

const Stack = createNativeStackNavigator<MeStackParamList>();

export default function MeStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MeHome"
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      <Stack.Screen name="MeHome" component={MeScreen} />
      <Stack.Screen
        name="EditKid"
        component={EditKidScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="AddKid"
        component={AddKidModalScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
