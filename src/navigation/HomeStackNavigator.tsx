import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '@/screens/Home/HomeScreen';
import VideoPlaybackScreen from '@/screens/VideoPlayback/VideoPlaybackScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
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
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="VideoPlayback"
        component={VideoPlaybackScreen}
        options={{ title: 'Coach video' }}
      />
    </Stack.Navigator>
  );
}
