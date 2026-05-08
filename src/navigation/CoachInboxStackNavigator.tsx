/**
 * Coach Inbox stack — wraps the Inbox tab with a native stack so we can push
 * the Record Video flow (and the Step 4.9 placeholder) without leaving the
 * tab. Header style mirrors MeStackNavigator for visual consistency.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CoachHomeScreen from '@/screens/Coach/CoachHomeScreen/CoachHomeScreen';
import CoachVideoPlaybackScreen from '@/screens/Coach/CoachVideoPlayback/CoachVideoPlaybackScreen';
import CreateAssignmentScreen from '@/screens/Coach/CreateAssignment/CreateAssignmentScreen';
import RecipientPickerScreen from '@/screens/Coach/RecipientPicker/RecipientPickerScreen';
import RecordVideoScreen from '@/screens/Coach/RecordVideo/RecordVideoScreen';
import ReviewAssignmentScreen from '@/screens/Coach/ReviewAssignment/ReviewAssignmentScreen';
import ReviewQueueScreen from '@/screens/Coach/ReviewQueue/ReviewQueueScreen';
import SendConfirmationScreen from '@/screens/Coach/SendConfirmation/SendConfirmationScreen';
import SentVideosScreen from '@/screens/Coach/SentVideos/SentVideosScreen';
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
        component={CoachHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecordVideo"
        component={RecordVideoScreen}
        options={{ title: 'Send a video' }}
      />
      <Stack.Screen
        name="RecipientPicker"
        component={RecipientPickerScreen}
        options={{ title: 'Send To' }}
      />
      <Stack.Screen
        name="SendConfirmation"
        component={SendConfirmationScreen}
        options={{ title: 'Send Video' }}
      />
      <Stack.Screen
        name="SentVideos"
        component={SentVideosScreen}
        options={{ title: 'My Videos' }}
      />
      <Stack.Screen
        name="CreateAssignment"
        component={CreateAssignmentScreen}
        options={{ title: 'New Drill' }}
      />
      <Stack.Screen
        name="ReviewQueue"
        component={ReviewQueueScreen}
        options={{ title: 'Review Drills' }}
      />
      <Stack.Screen
        name="ReviewAssignment"
        component={ReviewAssignmentScreen}
        options={{ title: 'Review' }}
      />
      <Stack.Screen
        name="CoachVideoPlayback"
        component={CoachVideoPlaybackScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
