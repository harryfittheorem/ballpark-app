import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Calendar, Coins, Dumbbell, Home, User } from 'lucide-react-native';

import { useCoachMessageBadge } from '@/hooks/useNewCoachMessage';
import BookScreen from '@/screens/Book/BookScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import EarnStackNavigator from './EarnStackNavigator';
import HomeStackNavigator from './HomeStackNavigator';
import MeStackNavigator from './MeStackNavigator';
import WorkStackNavigator from './WorkStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Task #135 — consolidated 5-tab nav (customer-finalized v0.4 design):
 *   Home · Work · Book · Earn · Me
 *
 * Work absorbs Videos + Train + Messages + Send-to-coach as in-screen
 * sub-tabs. Earn re-merges Rewards + Store + Ranks + Rules. Book is back
 * as a top-level tab. Me is slimmed (profile + settings).
 */
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
        }}
      />
      <Tab.Screen
        name="Work"
        component={WorkStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
          // Task #135: Messages now lives under Work, so the "new coach
          // message" badge follows it from the old Home tab.
          tabBarBadge: hasNewCoachMessage ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold },
        }}
      />
      <Tab.Screen
        name="Book"
        component={BookScreen}
        options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Earn"
        component={EarnStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Coins color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Me"
        component={MeStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
