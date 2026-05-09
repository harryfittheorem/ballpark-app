import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Coins,
  Dumbbell,
  Home,
  PlayCircle,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react-native';

import { useCoachMessageBadge } from '@/hooks/useNewCoachMessage';
import RanksScreen from '@/screens/Ranks/RanksScreen';
import TrainScreen from '@/screens/Train/TrainScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import HomeStackNavigator from './HomeStackNavigator';
import MeStackNavigator from './MeStackNavigator';
import RewardsStackNavigator from './RewardsStackNavigator';
import VideosStackNavigator from './VideosStackNavigator';
import WorkStackNavigator from './WorkStackNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * v0.7 task #119: 5 → 7 tabs.
 *   Home · Videos · Work · Train · Rewards · Ranks · Me
 *
 * Book is no longer a tab — it lives at Me → Book and as a Quick Action
 * on Home. Earn split into Rewards (pill switcher inside) + Ranks (own
 * tab). Tab labels are kept short so 7 tabs fit comfortably on the
 * narrowest supported viewport (iPhone SE 1st gen, 320pt wide).
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
          // Empty-string badge renders as a small dot indicator (presence,
          // not a count) — see Step 4.14.
          tabBarBadge: hasNewCoachMessage ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold },
        }}
      />
      <Tab.Screen
        name="Videos"
        component={VideosStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <PlayCircle color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Work"
        component={WorkStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Train"
        component={TrainScreen}
        options={{ tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Rewards"
        component={RewardsStackNavigator}
        options={{ tabBarIcon: ({ color, size }) => <Coins color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Ranks"
        component={RanksScreen}
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
