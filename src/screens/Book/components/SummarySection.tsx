import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes } from '@/theme';

import SectionCard from './SectionCard';

export default function SummarySection() {
  return (
    <SectionCard
      title="Summary"
      locked
      lockedHint="Pick a session type first."
    >
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Your booking summary will appear here.</Text>
      </View>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    minHeight: 80,
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.base,
    color: colors.textLight,
  },
});
