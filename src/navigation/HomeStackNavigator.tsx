import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AddKidScreen from '@/screens/Auth/AddKidScreen';
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
        options={{
          // True full-screen player: no header. The screen renders its own
          // top-left close button overlaid on the video. Modal presentation
          // hides the tab bar underneath on iOS.
          presentation: 'modal',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AddKid"
        component={AddKidScreen}
        options={{
          // AddKidScreen renders its own headline + sign-out escape, so
          // the native header would just be visual noise. Keeping it
          // hidden matches how AddKidScreen looks when shown as the root
          // (signed-in parent with no kid yet).
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
