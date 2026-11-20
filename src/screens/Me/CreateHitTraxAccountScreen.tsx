/**
 * CreateHitTraxAccountScreen — create a new HitTrax Cloud account in-app.
 *
 * Three-step flow:
 *   Step 1 — Choose a username (with live availability check)
 *   Step 2 — Set a password
 *   Step 3 — Sport details (sport, skill level, gender, position, bats, throws)
 *
 * On success the link is immediately 'active' — no separate association step.
 * Available from:
 *   • Me → HitTrax → "Create one in-app" (MeStack)
 *   • Onboarding → ConnectHitTrax → "Create one in-app" (HomeStack)
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input, PickerField } from '@/components/ui';
import { useCreateHitTraxAccount } from '@/hooks/useHitTraxLink';
import { useFamily } from '@/hooks/useFamily';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import { useIsFetching } from '@tanstack/react-query';
import { checkHitTraxUsernameAvailable } from '@/api/hittrax';
import { colors, fontFamilies, fontSizes, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Step = 1 | 2 | 3;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

const ALPHANUMERIC_RE = /^[A-Za-z0-9]+$/;

const SPORT_OPTIONS = [
  { value: 'Baseball' as const, label: 'Baseball' },
  { value: 'Fastpitch Softball' as const, label: 'Fastpitch' },
  { value: 'Slowpitch Softball' as const, label: 'Slowpitch' },
] as const;

const SKILL_OPTIONS = [
  { value: 'Youth', label: 'Youth' },
  { value: 'High School', label: 'High School' },
  { value: 'College', label: 'College' },
  { value: 'Adult', label: 'Adult' },
];

const GENDER_OPTIONS = [
  { value: 'male' as const, label: 'Male' },
  { value: 'female' as const, label: 'Female' },
  { value: 'other' as const, label: 'Other' },
] as const;

const BATS_OPTIONS = [
  { value: 'Right' as const, label: 'Right' },
  { value: 'Left' as const, label: 'Left' },
  { value: 'Switch' as const, label: 'Switch' },
] as const;

const THROWS_OPTIONS = [
  { value: 'Right' as const, label: 'Right' },
  { value: 'Left' as const, label: 'Left' },
] as const;

export default function CreateHitTraxAccountScreen() {
  const navigation = useNavigation();
  // route params — kidId is provided from the onboarding path
  const route = useRoute<{ key: string; name: string; params?: { kidId?: string } }>();
  const routeKidId = route.params?.kidId;

  const { kid: selectedKid } = useSelectedKid();
  const { kids } = useFamily();
  const isFetchingFamily = useIsFetching({ queryKey: ['family'] }) > 0;

  // When a specific kid was requested via route params, we ONLY use that kid.
  // Never fall back to selectedKid — that could silently create an account for
  // the wrong athlete if family data hasn't loaded yet.
  const kid = routeKidId
    ? kids.find((k) => k.id === routeKidId)
    : selectedKid;

  // If routeKidId was provided but the kid hasn't appeared in family data yet,
  // block the form until it resolves.
  const kidPending = Boolean(routeKidId && !kid && isFetchingFamily);

  const createAccount = useCreateHitTraxAccount(kid?.id);

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1: Username
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2: Password
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: Sport details
  const [sport, setSport] = useState<'Baseball' | 'Fastpitch Softball' | 'Slowpitch Softball' | null>('Baseball');
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [position, setPosition] = useState(kid?.primary_position ?? '');
  const [bats, setBats] = useState<'Right' | 'Left' | 'Switch' | null>(null);
  const [throws_, setThrows] = useState<'Right' | 'Left' | null>(null);

  // Keep position in sync when kid loads
  useEffect(() => {
    if (kid?.primary_position && !position) {
      setPosition(kid.primary_position);
    }
  }, [kid?.primary_position]);

  // Debounced username check
  const checkUsername = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkHitTraxUsernameAvailable(trimmed);
        setUsernameStatus(available ? 'available' : 'taken');
      } catch {
        setUsernameStatus('error');
      }
    }, 600);
  }, []);

  const onUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameStatus('idle');
    checkUsername(value);
  };

  // Step 1 → 2
  const onNextFromStep1 = () => {
    if (!username.trim()) {
      Alert.alert('Username required', 'Enter a HitTrax username.');
      return;
    }
    if (usernameStatus !== 'available') {
      Alert.alert('Check username', 'Please wait for the availability check or choose a different username.');
      return;
    }
    setStep(2);
  };

  // Step 2 → 3
  const onNextFromStep2 = () => {
    if (!password || password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    if (!ALPHANUMERIC_RE.test(password)) {
      Alert.alert('Invalid characters', 'Password must contain letters and numbers only — no spaces or symbols.');
      return;
    }
    setStep(3);
  };

  // Step 3 → Create
  const onCreateAccount = async () => {
    if (!sport) { Alert.alert('Sport required', 'Please select a sport.'); return; }
    if (!skillLevel) { Alert.alert('Skill level required', 'Please select a skill level.'); return; }
    if (!gender) { Alert.alert('Gender required', 'Please select a gender.'); return; }
    if (!kid) { Alert.alert('No athlete found', 'Add an athlete first.'); return; }

    try {
      await createAccount.mutateAsync({
        hittraxUsername: username.trim(),
        password,
        sport,
        skillLevel,
        gender,
        position: position.trim() || undefined,
        bats: bats ?? undefined,
        throws: throws_ ?? undefined,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Account creation failed', errorMessage(err));
    }
  };

  const onBack = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep((s) => (s - 1) as Step);
    }
  };

  const stepLabel = `Step ${step} of 3`;

  // Block the form until the specific kid is confirmed in family data.
  if (kidPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.gold} />
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.stepIndicator}>{stepLabel}</Text>
          </View>

          <Text style={styles.title}>Create HitTrax Account</Text>
          {kid ? (
            <Text style={styles.subtitle}>
              Creating account for{' '}
              <Text style={styles.kidName}>{kid.first_name} {kid.last_name}</Text>
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Set up a HitTrax account to auto-import cage swings into Clubhouse.
            </Text>
          )}

          {/* ─── Step 1: Username ─────────────────────────────────────── */}
          {step === 1 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Choose a username</Text>
              <Text style={styles.sectionNote}>
                This will be your athlete&apos;s HitTrax username. Pick something simple to remember.
              </Text>

              <Input
                label="HitTrax Username"
                placeholder="e.g. jsmith_hitting"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={username}
                onChangeText={onUsernameChange}
                testID="create-hittrax-username"
              />

              <View style={styles.availabilityRow}>
                {usernameStatus === 'checking' && (
                  <View style={styles.availabilityInner}>
                    <ActivityIndicator size="small" color={colors.gold} />
                    <Text style={styles.checkingText}>Checking availability…</Text>
                  </View>
                )}
                {usernameStatus === 'available' && (
                  <Text style={styles.availableText}>✓ Username is available</Text>
                )}
                {usernameStatus === 'taken' && (
                  <Text style={styles.takenText}>✗ Username is already taken</Text>
                )}
                {usernameStatus === 'error' && (
                  <Text style={styles.takenText}>Could not check — try again</Text>
                )}
              </View>

              <Text style={styles.fieldNote}>
                Letters, numbers, underscores and periods only. You can change this later on hittraxbaseball.com.
              </Text>

              <View style={styles.actions}>
                <Button
                  label="Next: Set Password"
                  onPress={onNextFromStep1}
                  disabled={usernameStatus !== 'available'}
                  testID="create-hittrax-next-1"
                />
              </View>
            </View>
          )}

          {/* ─── Step 2: Password ─────────────────────────────────────── */}
          {step === 2 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Set a password</Text>
              <Text style={styles.sectionNote}>
                Letters and numbers only, minimum 8 characters. Used to log into HitTrax kiosks.
              </Text>

              <View style={styles.passwordRow}>
                <View style={styles.passwordInput}>
                  <Input
                    label="Password"
                    placeholder="Letters and numbers only"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    testID="create-hittrax-password"
                  />
                </View>
                <TouchableOpacity
                  style={styles.showHide}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              {password.length > 0 && password.length < 8 && (
                <Text style={styles.takenText}>
                  {8 - password.length} more character{8 - password.length !== 1 ? 's' : ''} needed
                </Text>
              )}
              {password.length >= 8 && !ALPHANUMERIC_RE.test(password) && (
                <Text style={styles.takenText}>
                  Letters and numbers only — remove spaces or symbols
                </Text>
              )}

              <View style={[styles.actions, { marginTop: spacing['3xl'] }]}>
                <Button
                  label="Next: Sport Details"
                  onPress={onNextFromStep2}
                  disabled={password.length < 8 || !ALPHANUMERIC_RE.test(password)}
                  testID="create-hittrax-next-2"
                />
              </View>
            </View>
          )}

          {/* ─── Step 3: Sport details ────────────────────────────────── */}
          {step === 3 && (
            <View style={styles.stepContent}>
              <Text style={styles.sectionTitle}>Sport details</Text>
              <Text style={styles.sectionNote}>
                Help HitTrax calibrate benchmarks for this athlete.
              </Text>

              <Text style={styles.fieldLabel}>Sport *</Text>
              <PickerField
                options={SPORT_OPTIONS}
                value={sport}
                onChange={(v) => setSport(v as typeof sport)}
                mode="chips"
                allowClear={false}
                testID="create-hittrax-sport"
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing['2xl'] }]}>Skill Level *</Text>
              <PickerField
                options={SKILL_OPTIONS}
                value={skillLevel}
                onChange={(v) => setSkillLevel(v as string | null)}
                mode="chips"
                allowClear={false}
                testID="create-hittrax-skill-level"
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing['2xl'] }]}>Gender *</Text>
              <PickerField
                options={GENDER_OPTIONS}
                value={gender}
                onChange={(v) => setGender(v as typeof gender)}
                mode="chips"
                allowClear={false}
                testID="create-hittrax-gender"
              />

              <View style={{ marginTop: spacing['2xl'] }}>
                <Input
                  label="Position (optional)"
                  placeholder="e.g. SS, 1B, OF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={position}
                  onChangeText={setPosition}
                  testID="create-hittrax-position"
                />
              </View>

              <Text style={[styles.fieldLabel, { marginTop: spacing['2xl'] }]}>Bats (optional)</Text>
              <PickerField
                options={BATS_OPTIONS}
                value={bats}
                onChange={(v) => setBats(v as typeof bats)}
                mode="chips"
                testID="create-hittrax-bats"
              />

              <Text style={[styles.fieldLabel, { marginTop: spacing['2xl'] }]}>Throws (optional)</Text>
              <PickerField
                options={THROWS_OPTIONS}
                value={throws_}
                onChange={(v) => setThrows(v as typeof throws_)}
                mode="chips"
                testID="create-hittrax-throws"
              />

              <View style={[styles.actions, { marginTop: spacing['4xl'] }]}>
                <Button
                  label="Create Account"
                  onPress={onCreateAccount}
                  loading={createAccount.isPending}
                  testID="create-hittrax-submit"
                />
              </View>

              <Text style={styles.coppaNote}>
                If your athlete is under 13, HitTrax will send a parental consent email to your registered address before activating the account.
              </Text>
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
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: {
    flexGrow: 1,
    padding: spacing['4xl'],
    paddingBottom: spacing['6xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  backText: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  stepIndicator: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    letterSpacing: tracking.wide,
  },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    lineHeight: 22,
    marginBottom: spacing['3xl'],
  },
  kidName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interMedium,
  },
  stepContent: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    marginBottom: spacing.md,
  },
  sectionNote: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    lineHeight: 18,
    marginBottom: spacing['2xl'],
  },
  availabilityRow: {
    minHeight: 24,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  availabilityInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkingText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
  },
  availableText: {
    color: '#4ade80',
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  takenText: {
    color: '#f87171',
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  fieldNote: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    marginBottom: spacing['2xl'],
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  passwordInput: {
    flex: 1,
  },
  showHide: {
    paddingBottom: spacing.md,
  },
  showHideText: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: spacing['2xl'],
  },
  coppaNote: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: spacing['2xl'],
  },
});
