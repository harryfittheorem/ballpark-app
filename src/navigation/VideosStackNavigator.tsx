/**
 * Videos tab stack — task #119.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SessionDetailScreen from '@/screens/Videos/SessionDetailScreen';
import SwingDetailScreen from '@/screens/Videos/SwingDetailScreen';
import VideosScreen from '@/screens/Videos/VideosScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { VideosStackParamList } from './types';

const Stack = createNativeStackNavigator<VideosStackParamList>();

export default function VideosStackNavigator() {
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
      <Stack.Screen name="VideosHome" component={VideosScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={{ title: 'Session' }}
      />
      <Stack.Screen
        name="SwingDetail"
        component={SwingDetailScreen}
        options={{ title: 'Swing' }}
      />
    </Stack.Navigator>
  );
}
