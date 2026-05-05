import { useState } from 'react';
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
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const AGE_GROUP_OPTIONS: ReadonlyArray<PickerOption<AgeGroup>> = AGE_GROUPS.map((g) => ({
  value: g,
  label: g,
}));

export default function AddKidScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [position, setPosition] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addKid = useAddKid();

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing info', 'First and last name are required.');
      return;
    }
    setSubmitting(true);
    try {
      await addKid({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        age_group: ageGroup,
        primary_position: position.trim() || null,
      });
      // useFamily will re-fetch and the root navigator will swap to MainTabs.
    } catch (err) {
      console.error('addKid failed', err);
      Alert.alert('Could not add kid', errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('signOut failed', err);
      Alert.alert('Could not sign out', errorMessage(err));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add your kid</Text>
          <Text style={styles.subtitle}>You can add more later from the Me tab.</Text>

          <Input
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            required
          />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            required
          />

          <PickerField<AgeGroup>
            label="Age group (optional)"
            options={AGE_GROUP_OPTIONS}
            value={ageGroup}
            onChange={setAgeGroup}
            allowClear
            disabled={submitting}
          />

          <Input
            label="Primary position (optional)"
            value={position}
            onChangeText={setPosition}
            autoCapitalize="words"
            placeholder="e.g. Shortstop"
          />

          <Button
            label="Add kid"
            onPress={handleSubmit}
            loading={submitting}
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
              disabled={submitting}
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
