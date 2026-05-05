import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAddKid } from '@/hooks/useFamily';
import type { MeStackScreenProps } from '@/navigation/types';
import KidForm from '@/screens/Me/components/KidForm';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

type Props = MeStackScreenProps<'AddKid'>;

export default function AddKidModalScreen({ navigation }: Props) {
  const addKid = useAddKid();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add another kid</Text>
          <Text style={styles.subtitle}>They&apos;ll show up on the Me tab.</Text>

          <KidForm
            submitLabel="Add kid"
            onSubmit={async (values, picked) => {
              await addKid(
                {
                  first_name: values.first_name,
                  last_name: values.last_name,
                  age_group: values.age_group,
                  primary_position: values.primary_position,
                  jersey_number: values.jersey_number,
                },
                picked,
              );
              navigation.goBack();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },
  container: { padding: spacing['4xl'], paddingBottom: spacing['6xl'] },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginBottom: spacing['4xl'],
  },
});
