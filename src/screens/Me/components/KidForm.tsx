/**
 * Reusable form for both creating and editing a kid.
 *
 * Owns local form state, validation, and the avatar-picker UI; delegates
 * persistence (insert / update / avatar upload) to the caller via `onSubmit`.
 *
 * Used by:
 *   - AddKidScreen (onboarding, first kid)
 *   - AddKidModalScreen (Me tab → "Add another kid")
 *   - EditKidScreen (Me tab → edit existing kid)
 */

import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

const AGE_GROUPS = ['9U', '10U', '11U', '12U', '13U', '14U', '15U+'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export type KidFormValues = {
  first_name: string;
  last_name: string;
  age_group: AgeGroup | null;
  primary_position: string | null;
  jersey_number: number | null;
  avatar_url: string | null;
};

export type KidFormSubmit = (
  values: KidFormValues,
  pickedAvatar: ImagePicker.ImagePickerAsset | null,
) => Promise<void>;

type Props = {
  initialValues?: Partial<KidFormValues>;
  submitLabel: string;
  onSubmit: KidFormSubmit;
  onDelete?: () => Promise<void> | void;
  deleteLabel?: string;
};

const EMPTY: KidFormValues = {
  first_name: '',
  last_name: '',
  age_group: null,
  primary_position: null,
  jersey_number: null,
  avatar_url: null,
};

export default function KidForm({
  initialValues,
  submitLabel,
  onSubmit,
  onDelete,
  deleteLabel = 'Delete kid',
}: Props) {
  const merged = { ...EMPTY, ...initialValues };
  const [firstName, setFirstName] = useState(merged.first_name);
  const [lastName, setLastName] = useState(merged.last_name);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(merged.age_group);
  const [position, setPosition] = useState(merged.primary_position ?? '');
  const [jersey, setJersey] = useState(
    merged.jersey_number != null ? String(merged.jersey_number) : '',
  );
  const [pickedAvatar, setPickedAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const previewUri = pickedAvatar?.uri ?? merged.avatar_url ?? null;

  const handlePickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'We need photo library access to set an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPickedAvatar(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Missing info', 'First and last name are required.');
      return;
    }
    let jerseyNum: number | null = null;
    if (jersey.trim()) {
      const parsed = parseInt(jersey.trim(), 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 999) {
        Alert.alert('Invalid jersey', 'Jersey number must be between 0 and 999.');
        return;
      }
      jerseyNum = parsed;
    }
    setSubmitting(true);
    try {
      await onSubmit(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          age_group: ageGroup,
          primary_position: position.trim() || null,
          jersey_number: jerseyNum,
          avatar_url: merged.avatar_url,
        },
        pickedAvatar,
      );
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete kid?', 'This removes the kid from your family. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <View>
      <View style={styles.avatarRow}>
        <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>
                {firstName ? firstName.charAt(0).toUpperCase() : '+'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickAvatar}>
          <Text style={styles.avatarAction}>
            {previewUri ? 'Change photo' : 'Add a photo'}
          </Text>
        </TouchableOpacity>
      </View>

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

      <View style={styles.field}>
        <Text style={styles.label}>Jersey number (optional)</Text>
        <TextInput
          style={styles.input}
          value={jersey}
          onChangeText={setJersey}
          keyboardType="number-pad"
          maxLength={3}
          placeholder="e.g. 7"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting || deleting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.darkest} />
        ) : (
          <Text style={styles.primaryBtnText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>

      {onDelete ? (
        <TouchableOpacity
          style={[styles.dangerBtn, deleting && styles.btnDisabled]}
          onPress={handleDelete}
          disabled={submitting || deleting}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.dangerBtnText}>{deleteLabel}</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing['4xl'],
  },
  avatarWrap: { marginBottom: spacing.lg },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.darker,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
  },
  avatarPlaceholderText: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  avatarAction: {
    color: colors.gold,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  dangerBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    marginTop: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerBtnText: {
    color: colors.danger,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
