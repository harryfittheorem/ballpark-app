import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button, Input, PickerField, type PickerOption } from '@/components/ui';
import { AGE_GROUPS, type AgeGroup } from '@/constants/kid';
import { useFamily, useEditKid } from '@/hooks/useFamily';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const editKidSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  ageGroup: z.string().nullable().optional(),
  position: z.string().optional(),
  jerseyNumber: z.string().optional(),
});

type FormValues = z.infer<typeof editKidSchema>;

const AGE_GROUP_OPTIONS: ReadonlyArray<PickerOption<AgeGroup>> = AGE_GROUPS.map((g) => ({
  value: g,
  label: g,
}));

type Props = MeStackScreenProps<'EditKid'>;

export default function EditKidScreen({ route, navigation }: Props) {
  const { kidId } = route.params;
  const { kids } = useFamily();
  const editKid = useEditKid();

  const kid = useMemo(() => kids.find((k) => k.id === kidId) ?? null, [kids, kidId]);

  const { control, handleSubmit, formState, reset } = useForm<FormValues>({
    resolver: zodResolver(editKidSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      ageGroup: null,
      position: '',
      jerseyNumber: '',
    },
  });

  useEffect(() => {
    if (kid) {
      reset({
        firstName: kid.first_name ?? '',
        lastName: kid.last_name ?? '',
        ageGroup: kid.age_group ?? null,
        position: kid.primary_position ?? '',
        jerseyNumber: kid.jersey_number != null ? String(kid.jersey_number) : '',
      });
    }
  }, [kid, reset]);

  const submitting = formState.isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const jerseyNum =
        values.jerseyNumber && values.jerseyNumber.trim() !== ''
          ? Number(values.jerseyNumber)
          : null;
      await editKid({
        kidId,
        first_name: values.firstName,
        last_name: values.lastName ?? null,
        age_group: values.ageGroup ?? null,
        primary_position: values.position ?? null,
        jersey_number: Number.isNaN(jerseyNum) ? null : jerseyNum,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Could not save changes', errorMessage(err));
    }
  });

  if (!kid) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.missing}>Athlete not found.</Text>
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
          <Text style={styles.title}>Edit athlete</Text>

          <Controller
            control={control}
            name="firstName"
            render={({ field, fieldState }) => (
              <Input
                label="First name"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                required
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field, fieldState }) => (
              <Input
                label="Last name"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="ageGroup"
            render={({ field, fieldState }) => (
              <PickerField<AgeGroup>
                label="Age group (optional)"
                options={AGE_GROUP_OPTIONS}
                value={field.value as AgeGroup | null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                allowClear
                disabled={submitting}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="position"
            render={({ field, fieldState }) => (
              <Input
                label="Primary position (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="words"
                placeholder="e.g. Shortstop"
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="jerseyNumber"
            render={({ field, fieldState }) => (
              <Input
                label="Jersey number (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="number-pad"
                placeholder="e.g. 7"
                error={fieldState.error?.message}
              />
            )}
          />

          <Button
            label="Save changes"
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            testID="editkid-submit"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.lg,
    color: colors.textMuted,
  },
  container: { padding: spacing['4xl'], paddingBottom: spacing['6xl'] },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    marginBottom: spacing['4xl'],
  },
});
