import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation, useRoute } from '@react-navigation/native';
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
import { useSelectedKidStore } from '@/store/selectedKid';
import type { HomeStackScreenProps, MeStackScreenProps } from '@/navigation/types';
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

type HomeRoute = HomeStackScreenProps<'AddKid'>['route'];
type MeRoute = MeStackScreenProps<'AddKid'>['route'];

export default function AddKidScreen() {
  const addKid = useAddKid();
  const { family } = useFamily();
  const locations = useTenantLocations();
  const setSelectedKid = useSelectedKidStore((s) => s.setSelectedKid);

  // The screen lives in both HomeStack and MeStack. Check route params to
  // determine origin — MeStack always passes fromMe: true.
  const route = useRoute<HomeRoute | MeRoute>();
  const fromMe = (route.params as { fromMe?: boolean } | undefined)?.fromMe ?? false;

  // Navigation typed to the HomeStack version (superset of goBack + full
  // tab navigate). When fromMe we only call goBack() so MeStack is safe.
  const navigation = useNavigation<HomeStackScreenProps<'AddKid'>['navigation']>();

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
      const created = await addKid({
        first_name: values.firstName,
        last_name: values.lastName,
        age_group: values.ageGroup,
        primary_position: values.position,
        primary_location_id: values.locationId,
      });

      // Always switch to the newly added kid.
      setSelectedKid(created.id);

      if (fromMe) {
        // Opened from the Me tab — just pop back to profile.
        navigation.goBack();
      } else {
        // Onboarding flow — proceed to HitTrax linking gate.
        navigation.navigate('ConnectHitTraxOnboarding', { kidId: created.id });
      }
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
          <Text style={styles.title}>{fromMe ? 'Add another athlete' : 'Add your kid'}</Text>
          <Text style={styles.subtitle}>
            {fromMe
              ? 'Fill in their details below to add them to your account.'
              : 'You can add more later from the Me tab.'}
          </Text>

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
            label={fromMe ? 'Add athlete' : 'Add kid'}
            onPress={onSubmit}
            loading={submitting}
            disabled={busy}
            testID="addkid-submit"
          />

          {fromMe ? null : (
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
          )}
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
