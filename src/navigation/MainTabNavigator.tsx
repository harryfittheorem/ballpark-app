import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Calendar, Dumbbell, Home, Trophy, User } from 'lucide-react-native';

import { useCoachMessageBadge } from '@/hooks/useNewCoachMessage';
import BookScreen from '@/screens/Book/BookScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import EarnStackNavigator from './EarnStackNavigator';
import HomeStackNavigator from './HomeStackNavigator';
import MeStackNavigator from './MeStackNavigator';
import WorkStackNavigator from './WorkStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const hasNewCoachMessage = useCoachMessageBadge();
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
        name="Home"
        component={HomeStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          // Empty-string badge renders as a small dot indicator (presence,
          // not a count) — see Step 4.14.
          tabBarBadge: hasNewCoachMessage ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold },
        }}
      />
      <Tab.Screen
        name="Work"
        component={WorkStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Book"
        component={BookScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Earn"
        component={EarnStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
