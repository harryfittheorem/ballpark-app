/**
 * TrainStackNavigator (v0.7 task #121).
 *
 * Train tab is a Stack now: TrainHome (the catalog) + TrainingVideoPlayer
 * (full hero + metadata). Pushing inside the tab keeps the back affordance
 * native to the tab — same pattern as the Videos tab.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TrainScreen from '@/screens/Train/TrainScreen';
import TrainingVideoPlayerScreen from '@/screens/Train/TrainingVideoPlayerScreen';

import type { TrainStackParamList } from './types';

const Stack = createNativeStackNavigator<TrainStackParamList>();

export default function TrainStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TrainHome" component={TrainScreen} />
      <Stack.Screen name="TrainingVideoPlayer" component={TrainingVideoPlayerScreen} />
    </Stack.Navigator>
  );
}
