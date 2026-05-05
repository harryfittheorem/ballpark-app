import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
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

import { signOut } from '@/api/auth';
import { Button, Input, PickerField, type PickerOption } from '@/components/ui';
import { AGE_GROUPS, type AgeGroup } from '@/constants/kid';
import { useAddKid } from '@/hooks/useFamily';
import {
  addKidSchema,
  type AddKidFormOutput,
  type AddKidFormValues,
} from '@/screens/Auth/schemas';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const AGE_GROUP_OPTIONS: ReadonlyArray<PickerOption<AgeGroup>> = AGE_GROUPS.map((g) => ({
  value: g,
  label: g,
}));

export default function AddKidScreen() {
  const addKid = useAddKid();
  const [signingOut, setSigningOut] = useState(false);

  const { control, handleSubmit, formState } = useForm<
    AddKidFormValues,
    unknown,
    AddKidFormOutput
  >({
    resolver: zodResolver(addKidSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      ageGroup: null,
      position: '',
    },
  });

  const submitting = formState.isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await addKid({
        first_name: values.firstName,
        last_name: values.lastName,
        age_group: values.ageGroup,
        primary_position: values.position,
      });
      // useFamily will re-fetch and the root navigator will swap to MainTabs.
    } catch (err) {
      console.error('addKid failed', err);
      Alert.alert('Could not add kid', errorMessage(err));
    }
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('signOut failed', err);
      Alert.alert('Could not sign out', errorMessage(err));
    } finally {
      setSigningOut(false);
    }
  };

  const busy = submitting || signingOut;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add your kid</Text>
          <Text style={styles.subtitle}>You can add more later from the Me tab.</Text>

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
            name="ageGroup"
            render={({ field, fieldState }) => (
              <PickerField<AgeGroup>
                label="Age group (optional)"
                options={AGE_GROUP_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                allowClear
                disabled={busy}
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

          <Button
            label="Add kid"
            onPress={onSubmit}
            loading={submitting}
            disabled={busy}
            testID="addkid-submit"
          />

          {/* Escape hatch: a user with a stale or wrong session is otherwise
              trapped here (no kid → can't reach the Me tab → can't sign out).
              The auth listener in useAuth flips RootNavigator back to SignIn. */}
          <View style={styles.signOutWrap}>
            <Button
              label="SIGN OUT"
              onPress={handleSignOut}
              variant="tertiary"
              tone="muted"
              disabled={busy}
              testID="addkid-sign-out"
            />
          </View>
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
  signOutWrap: {
    marginTop: spacing.lg,
  },
});
