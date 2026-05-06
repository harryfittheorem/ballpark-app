/**
 * Work stack — wraps the Work tab with a native stack so we can push the
 * per-assignment detail screen without leaving the tab. Header style
 * matches the other tab stacks.
 */

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AssignmentDetailScreen from '@/screens/Work/AssignmentDetailScreen';
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
    </Stack.Navigator>
  );
}
