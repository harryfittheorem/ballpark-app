import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDeleteKid, useFamily, useUpdateKid } from '@/hooks/useFamily';
import type { MeStackScreenProps } from '@/navigation/types';
import KidForm, { type AgeGroup } from '@/screens/Me/components/KidForm';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';

type Props = MeStackScreenProps<'EditKid'>;

export default function EditKidScreen({ route, navigation }: Props) {
  const { kidId } = route.params;
  const { kids } = useFamily();
  const updateKid = useUpdateKid();
  const deleteKid = useDeleteKid();

  const kid = kids.find((k) => k.id === kidId);

  if (!kid) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>Kid not found</Text>
          <Text style={styles.subtitle}>It may have been removed.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>
            Edit {kid.first_name}
          </Text>
          <Text style={styles.subtitle}>Update profile info or remove this kid.</Text>

          <KidForm
            submitLabel="Save changes"
            initialValues={{
              first_name: kid.first_name,
              last_name: kid.last_name,
              age_group: (kid.age_group as AgeGroup | null) ?? null,
              primary_position: kid.primary_position,
              jersey_number: kid.jersey_number,
              avatar_url: kid.avatar_url,
            }}
            onSubmit={async (values, picked) => {
              await updateKid(
                kid.id,
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
            onDelete={async () => {
              await deleteKid(kid.id);
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
