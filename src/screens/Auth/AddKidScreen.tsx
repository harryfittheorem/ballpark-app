import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { useAddKid } from '@/hooks/useFamily';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

const AGE_GROUPS = ['9U', '10U', '11U', '12U', '13U', '14U', '15U+'] as const;
type AgeGroup = (typeof AGE_GROUPS)[number];

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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add your kid</Text>
          <Text style={styles.subtitle}>You can add more later from the Me tab.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>First name</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Last name</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Age group (optional)</Text>
            <View style={styles.chipRow}>
              {AGE_GROUPS.map((g) => {
                const selected = g === ageGroup;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => setAgeGroup(selected ? null : g)}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Primary position (optional)</Text>
            <TextInput
              style={styles.input}
              value={position}
              onChangeText={setPosition}
              autoCapitalize="words"
              placeholder="e.g. Shortstop"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.darkest} />
            ) : (
              <Text style={styles.primaryBtnText}>Add kid</Text>
            )}
          </TouchableOpacity>

          {/* Escape hatch: a user with a stale or wrong session is otherwise
              trapped here (no kid → can't reach the Me tab → can't sign out).
              The auth listener in useAuth flips RootNavigator back to SignIn. */}
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={async () => {
              try {
                await signOut();
              } catch (err) {
                console.error('signOut failed', err);
                Alert.alert('Could not sign out', errorMessage(err));
              }
            }}
            disabled={submitting}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
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
  field: { marginBottom: spacing['3xl'] },
  label: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  chip: {
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.darker,
  },
  chipSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
  },
  chipTextSelected: { color: colors.darkest },
  primaryBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    marginTop: spacing['2xl'],
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: colors.darkest,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    marginTop: spacing.lg,
  },
  signOutText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
