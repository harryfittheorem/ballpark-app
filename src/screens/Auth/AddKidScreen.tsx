import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
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
import { useFamily, useAddKid } from '@/hooks/useFamily';
import {
  addKidSchema,
  type AddKidFormOutput,
  type AddKidFormValues,
} from '@/screens/Auth/schemas';
import { useTenantLocations } from '@/screens/Book/hooks/useTenantLocations';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const AGE_GROUP_OPTIONS: ReadonlyArray<PickerOption<AgeGroup>> = AGE_GROUPS.map((g) => ({
  value: g,
  label: g,
}));

export default function AddKidScreen() {
  const addKid = useAddKid();
  const { family } = useFamily();
  const locations = useTenantLocations();
  const navigation = useNavigation();
  // When AddKid is pushed from the Home empty state, we want to pop back
  // to Home after a successful add. When AddKid is the top of the
  // navigator (no back stack) it's only reachable as the first thing a
  // freshly-signed-up parent sees, but with the kids list now flipping
  // RootNavigator/MainTabs render Home directly — there's no `canGoBack`
  // to use, and the screen unmounts naturally.
  const [signingOut, setSigningOut] = useState(false);

  const locationOptions = useMemo<ReadonlyArray<PickerOption<string>>>(
    () => (locations.data ?? []).map((l) => ({ value: l.id, label: l.name })),
    [locations.data],
  );
  const hasLocations = locationOptions.length > 0;

  const { control, handleSubmit, formState, setValue, watch } = useForm<
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
      locationId: null,
    },
  });

  // Default the picker to the trigger-set primary_location_id once the
  // family + locations both load. Only set if the parent hasn't already
  // touched the field.
  const watchedLocationId = watch('locationId');
  const familyDefault = family?.primary_location_id ?? null;
  useEffect(() => {
    if (
      hasLocations &&
      watchedLocationId === null &&
      familyDefault &&
      locationOptions.some((o) => o.value === familyDefault)
    ) {
      setValue('locationId', familyDefault, { shouldDirty: false });
    }
  }, [hasLocations, watchedLocationId, familyDefault, locationOptions, setValue]);

  const submitting = formState.isSubmitting;

  const onSubmit = handleSubmit(async (values) => {
    if (hasLocations && !values.locationId) {
      Alert.alert('Pick a home location', 'Choose where your kid trains.');
      return;
    }
    try {
      await addKid({
        first_name: values.firstName,
        last_name: values.lastName,
        age_group: values.ageGroup,
        primary_position: values.position,
        primary_location_id: values.locationId,
      });
      // useFamily will re-fetch; if we were pushed from Home's empty
      // state, pop back so the parent lands on the freshly-populated
      // Home view instead of being stuck on this form.
      if (navigation.canGoBack()) navigation.goBack();
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

          {hasLocations ? (
            <Controller
              control={control}
              name="locationId"
              render={({ field, fieldState }) => (
                <PickerField<string>
                  label="Home location"
                  options={locationOptions}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  allowClear={false}
                  required
                  disabled={busy}
                  error={fieldState.error?.message}
                />
              )}
            />
          ) : null}

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
