/**
 * Coach Inbox stack — wraps the Inbox tab with a native stack so we can push
 * the Record Video flow (and the Step 4.9 placeholder) without leaving the
 * tab. Header style mirrors MeStackNavigator for visual consistency.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InboxScreen from '@/screens/Coach/Inbox/InboxScreen';
import RecipientPickerScreen from '@/screens/Coach/RecipientPicker/RecipientPickerScreen';
import RecordVideoScreen from '@/screens/Coach/RecordVideo/RecordVideoScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { CoachInboxStackParamList } from './types';

const Stack = createNativeStackNavigator<CoachInboxStackParamList>();

export default function CoachInboxStackNavigator() {
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
      <Stack.Screen
        name="InboxHome"
        component={InboxScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecordVideo"
        component={RecordVideoScreen}
        options={{ title: 'New Video' }}
      />
      <Stack.Screen
        name="RecipientPicker"
        component={RecipientPickerScreen}
        options={{ title: 'Send To' }}
      />
    </Stack.Navigator>
  );
}
