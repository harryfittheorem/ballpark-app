import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Inbox } from 'lucide-react-native';

import InboxScreen from '@/screens/Coach/InboxScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { CoachTabParamList } from './types';

const Tab = createBottomTabNavigator<CoachTabParamList>();

export default function CoachTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.darker,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamilies.interMedium,
          fontSize: fontSizes.xs,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
      }}
    >
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
