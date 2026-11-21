import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

type Nav = CoachInboxStackScreenProps<'RecipientPicker'>['navigation'];

export default function RecipientPickerScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.kicker}>MESSAGE POLICY</Text>
        <Text style={styles.title}>Recipient selection unavailable</Text>
        <Text style={styles.body}>
          Instructor-to-player messaging is unavailable. Adult messaging awaits approval. Existing conversations remain available to read; video recording for training assignments is still supported.
        </Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => navigation.popToTop()}>
          <Text style={styles.buttonText}>Return to coach home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  content: { flex: 1, justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg },
  kicker: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, letterSpacing: 1.4, fontSize: fontSizes.sm },
  title: { color: colors.cream, fontFamily: fontFamilies.oswaldBold, fontSize: 28 },
  body: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.md, lineHeight: 23 },
  button: { backgroundColor: colors.gold, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
  buttonText: { color: colors.dark, fontFamily: fontFamilies.oswaldBold, textTransform: 'uppercase', fontSize: fontSizes.md },
});
