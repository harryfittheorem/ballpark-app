import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Calendar, Dumbbell, Home, Trophy, User } from 'lucide-react-native';

import BookScreen from '@/screens/Book/BookScreen';
import EarnScreen from '@/screens/Earn/EarnScreen';
import HomeScreen from '@/screens/Home/HomeScreen';
import MeScreen from '@/screens/Me/MeScreen';
import WorkScreen from '@/screens/Work/WorkScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
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
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Work"
        component={WorkScreen}
        options={{ tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Book"
        component={BookScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Earn"
        component={EarnScreen}
        options={{ tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
