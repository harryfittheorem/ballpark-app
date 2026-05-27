import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CoachInboxStackNavigator from './CoachInboxStackNavigator';
import type { CoachTabParamList } from './types';

const Tab = createBottomTabNavigator<CoachTabParamList>();

export default function CoachTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen
        name="Inbox"
        component={CoachInboxStackNavigator}
      />
    </Tab.Navigator>
  );
}
