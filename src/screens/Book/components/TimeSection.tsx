import { StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, fontSizes } from '@/theme';

import SectionCard from './SectionCard';

type Props = {
  locked: boolean;
  lockedHint?: string;
};

export default function TimeSection({ locked, lockedHint }: Props) {
  return (
    <SectionCard
      title="Time"
      locked={locked}
      lockedHint={locked ? lockedHint : undefined}
    >
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Available time slots will appear here.</Text>
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
