/**
 * WorkStackNavigator — task #135.
 *
 * Hosts the unified Work tab. WorkHome is a single screen with five
 * in-screen sub-tabs (Swings / Assign / Messages / HW / Drills); the
 * remaining routes are push destinations the sub-tabs navigate into.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssignmentDetailScreen from '@/screens/Work/AssignmentDetailScreen';
import MessagesInboxScreen from '@/screens/Messages/MessagesInboxScreen';
import MessageThreadScreen from '@/screens/Messages/MessageThreadScreen';
import SendVideoSuccessScreen from '@/screens/SendVideoToCoach/SendVideoSuccessScreen';
import SendVideoToCoachScreen from '@/screens/SendVideoToCoach/SendVideoToCoachScreen';
import SessionDetailScreen from '@/screens/Videos/SessionDetailScreen';
import ShareCardScreen from '@/screens/ShareCard/ShareCardScreen';
import SwingDetailScreen from '@/screens/Videos/SwingDetailScreen';
import TrainingVideoPlayerScreen from '@/screens/Train/TrainingVideoPlayerScreen';
import WorkScreen from '@/screens/Work/WorkScreen';
import { colors, fontFamilies, fontSizes } from '@/theme';

import type { WorkStackParamList } from './types';

const Stack = createNativeStackNavigator<WorkStackParamList>();

export default function WorkStackNavigator() {
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
      <Stack.Screen name="WorkHome" component={WorkScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="AssignmentDetail"
        component={AssignmentDetailScreen}
        options={{ title: 'Drill' }}
      />
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
      <Stack.Screen
        name="ShareCard"
        component={ShareCardScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="SendVideoToCoach"
        component={SendVideoToCoachScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen
        name="SendVideoSuccess"
        component={SendVideoSuccessScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MessagesInbox"
        component={MessagesInboxScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MessageThread"
        component={MessageThreadScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="TrainingVideoPlayer"
        component={TrainingVideoPlayerScreen}
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
    </Stack.Navigator>
  );
}
