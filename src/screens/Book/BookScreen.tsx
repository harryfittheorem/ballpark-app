import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing } from '@/theme';

import BookHeader from './components/BookHeader';
import CoachSection from './components/CoachSection';
import DateSection from './components/DateSection';
import SessionTypeSection from './components/SessionTypeSection';
import SummarySection from './components/SummarySection';
import TimeSection from './components/TimeSection';
import { styles } from './styles';

export default function BookScreen() {
  const tabBarHeight = useBottomTabBarHeight();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BookHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SessionTypeSection />
        </View>
        <View style={styles.section}>
          <DateSection />
        </View>
        <View style={styles.section}>
          <TimeSection />
        </View>
        <View style={styles.section}>
          <CoachSection />
        </View>
        <View style={styles.section}>
          <SummarySection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
