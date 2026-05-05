import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes } from '@/theme';

import SectionCard from './SectionCard';

export default function SessionTypeSection() {
  return (
    <SectionCard title="Session Type" subtitle="Choose what you want to book.">
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Session type options coming soon.</Text>
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
