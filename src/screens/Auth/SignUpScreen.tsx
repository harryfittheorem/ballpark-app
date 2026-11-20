import { zodResolver } from '@hookform/resolvers/zod';
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

import { signUpParent } from '@/api/auth';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { AuthStackScreenProps } from '@/navigation/types';
import {
  signUpSchema,
  type SignUpFormOutput,
  type SignUpFormValues,
} from '@/screens/Auth/schemas';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? '';

type Props = AuthStackScreenProps<'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const { control, handleSubmit, formState } = useForm<
    SignUpFormValues,
    unknown,
    SignUpFormOutput
  >({
    resolver: zodResolver(signUpSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const signUpData = {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
      };

      if (TENANT_SLUG) {
        // Single-tenant build: resolve locations for this tenant first.
        // Fail-closed: if the tenant or its locations cannot be resolved, block signup.
        const { data: tenantRows, error: tenantErr } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', TENANT_SLUG)
          .limit(1);

        if (tenantErr) throw tenantErr;

        const tenantId = tenantRows?.[0]?.id ?? null;
        if (!tenantId) {
          throw new Error('Facility configuration error. Please contact support.');
        }

        const { data: locs, error: locsErr } = await supabase
          .from('locations')
          .select('id')
          .eq('tenant_id', tenantId)
          .order('name');

        if (locsErr) throw locsErr;

        if (!locs || locs.length === 0) {
          throw new Error('No active locations are available. Please contact support.');
        }

        if (locs.length > 1) {
          // Multiple locations — let the parent choose.
          navigation.navigate('LocationPicker', { signUpData });
          return;
        }

        // Exactly one location — auto-select and skip the picker.
        await signUpParent({
          ...signUpData,
          locationId: locs[0].id,
        });
        // Auth state listener routes us into the app.
      } else {
        // Multi-tenant: navigate to location picker first.
        navigation.navigate('LocationPicker', { signUpData });
      }
    } catch (err) {
      Alert.alert('Sign-up failed', errorMessage(err));
    }
  });

  const submitting = formState.isSubmitting;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.brand}>CLUBHOUSE</Text>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Parents — add your kid in the next step.</Text>

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
            name="email"
            render={({ field, fieldState }) => (
              <Input
                label="Email"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                required
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field, fieldState }) => (
              <Input
                label="Phone (optional)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Input
                label="Password"
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password-new"
                textContentType="newPassword"
                required
                error={fieldState.error?.message}
              />
            )}
          />

          <Button
            label={TENANT_SLUG ? 'Sign up' : 'Choose your location →'}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
            testID="signup-submit"
          />

          <View style={styles.linkWrap}>
            <Button
              label="Already have an account? Sign in"
              onPress={() => navigation.navigate('SignIn')}
              variant="tertiary"
              disabled={submitting}
              testID="signup-go-to-signin"
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
  brand: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    textAlign: 'center',
    marginBottom: spacing['4xl'],
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes['2xl'],
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginBottom: spacing['4xl'],
  },
  linkWrap: {
    marginTop: spacing['3xl'],
  },
});
