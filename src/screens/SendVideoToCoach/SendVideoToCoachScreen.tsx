/**
 * SendVideoToCoachScreen — v0.7 task #120.
 *
 * Four-step parent compose flow. Single screen, in-screen stepper.
 *
 *   Step 1 — Source:    Record / Library picker (expo-image-picker).
 *   Step 2 — Tag:       choose label (game_footage / home_practice / etc.).
 *   Step 3 — Caption:   recipient coach + free-form caption.
 *   Step 4 — Sent from: short attribution string ("Mom"). Tap Send.
 *
 * Upload pipeline mirrors the coach's RecordVideoScreen — mint an
 * Idempotency-Key, call `createMuxUpload({ purpose: 'parent_to_coach' })`,
 * PUT to Mux, then INSERT a coach_messages row via `useSendParentMessage`.
 *
 * On success we navigate to a SendVideoSuccess screen and pop the composer
 * off the stack.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  FolderOpen,
  Send,
  Tag,
  User as UserIcon,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createMuxUpload } from '@/api/mux';
import { COMPOSER_LABELS, type ComposerLabel } from '@/api/parentMessages';
import { useSelectedKid } from '@/hooks/useSelectedKid';
import {
  useSendParentMessage,
  useTenantCoachesForParent,
} from '@/hooks/useParentMessages';
import type { WorkStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';
import { uploadVideoToMux } from '@/utils/uploadVideo';
import { uuidv4 } from '@/utils/uuid';

import { styles } from './styles';

type Nav = WorkStackScreenProps<'SendVideoToCoach'>['navigation'];
type Route = WorkStackScreenProps<'SendVideoToCoach'>['route'];

type Step = 1 | 2 | 3 | 4;

type PickedAsset = { uri: string; mimeType: string };

export default function SendVideoToCoachScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const initialCoachId = route.params?.coachUserId ?? null;

  const { family, kid } = useSelectedKid();
  
  const { data: coaches, isPending: coachesPending } = useTenantCoachesForParent();

  const [step, setStep] = useState<Step>(1);
  const [asset, setAsset] = useState<PickedAsset | null>(null);
  const [label, setLabel] = useState<ComposerLabel | null>(null);
  const [coachId, setCoachId] = useState<string | null>(initialCoachId);
  const [caption, setCaption] = useState('');
  // Sent-from selector (Step 4). Options surface the parent's actual name
  // (from the family row), generic Mom/Dad chips so multi-parent
  // households don't have to type, and the kid's first name. The user can
  // also type a custom value via the "Other" chip + text input. We default
  // to the parent's first name when present so the common case is one tap.
  const sentFromOptions = useMemo<string[]>(() => {
    const opts: string[] = [];
    const push = (v: string | null | undefined) => {
      const trimmed = (v ?? '').trim();
      if (!trimmed) return;
      if (opts.some((o) => o.toLowerCase() === trimmed.toLowerCase())) return;
      opts.push(trimmed);
    };
    push(family?.parent_first_name);
    push('Mom');
    push('Dad');
    push(kid?.first_name);
    return opts;
  }, [family?.parent_first_name, kid?.first_name]);
  const [senderDisplay, setSenderDisplay] = useState<string>(
    family?.parent_first_name?.trim() || sentFromOptions[0] || '',
  );
  const [sentFromMode, setSentFromMode] = useState<'preset' | 'custom'>('preset');
  const [customSender, setCustomSender] = useState<string>('');
  const [progress, setProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idemKeyRef = useRef<string | null>(null);

  // Pre-select a coach if the picker only has one or pre-fill from route.
  useEffect(() => {
    if (coachId || !coaches) return;
    if (coaches.length === 1) setCoachId(coaches[0].userId);
  }, [coachId, coaches]);

  const sendMutation = useSendParentMessage(
    kid && coachId ? { kidId: kid.id, coachUserId: coachId } : null,
  );

  const pick = useCallback(async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera access needed',
          'Allow camera access in Settings to record a clip.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photos access needed',
          'Allow Photos access in Settings to pick a clip.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            videoMaxDuration: 120,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: 0.8,
          });
    if (result.canceled) return;
    const a = result.assets[0];
    setAsset({ uri: a.uri, mimeType: a.mimeType ?? 'video/mp4' });
    idemKeyRef.current = uuidv4();
    setStep(2);
  }, []);

  const onSend = useCallback(async () => {
    if (!asset || !kid || !family || !coachId) {
      Alert.alert('Missing info', 'Pick a video and a coach before sending.');
      return;
    }
    setSubmitting(true);
    setProgress(0);
    try {
      const resolvedSender =
        (sentFromMode === 'custom' ? customSender : senderDisplay).trim() || null;
      const idemKey = idemKeyRef.current ?? uuidv4();
      idemKeyRef.current = idemKey;
      const { upload_url, video_id } = await createMuxUpload(idemKey, 'parent_to_coach');
      const { promise } = uploadVideoToMux({
        uploadUrl: upload_url,
        fileUri: asset.uri,
        contentType: asset.mimeType,
        onProgress: (f) => setProgress(f),
      });
      await promise;
      setProgress(1);

      await sendMutation.mutateAsync({
        videoId: video_id,
        recipientFamilyId: family.id,
        recipientKidId: kid.id,
        recipientCoachUserId: coachId,
        label,
        senderDisplay: resolvedSender,
        messageText: caption.trim() || null,
      });

      // Coach push fan-out is delivered server-side from `mux-webhook` once
      // the Mux asset reaches `ready` (see fanOutParentToCoachNotifications
      // in supabase/functions/mux-webhook/index.ts). We intentionally do NOT
      // call send-push-notification from the client — that endpoint requires
      // a service-role bearer the client cannot hold.

      navigation.replace('SendVideoSuccess', {
        coachUserId: coachId,
        kidId: kid.id,
      });
    } catch (err) {
      Alert.alert('Send failed', errorMessage(err));
      setSubmitting(false);
      setProgress(null);
    }
  }, [
    asset,
    kid,
    family,
    coachId,
    label,
    senderDisplay,
    sentFromMode,
    customSender,
    caption,
    sendMutation,
    navigation,
  ]);

  const stepTitle = useMemo(
    () => ({ 1: 'PICK A CLIP', 2: 'TAG IT', 3: 'CAPTION & COACH', 4: 'SENT FROM' }),
    [],
  )[step];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => (step === 1 ? navigation.goBack() : setStep(((step - 1) || 1) as Step))}
          hitSlop={12}
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.textOnDark} />
        </Pressable>
        <Text style={styles.headerTitle}>{stepTitle}</Text>
        <View style={{ width: 22 }} />
      </View>

      <Stepper step={step} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {step === 1 ? (
            <View style={{ gap: spacing['2xl'] }}>
              <BigOption
                icon={<Camera size={26} color={colors.dark} />}
                label="Record a clip"
                onPress={() => pick('camera')}
                primary
              />
              <BigOption
                icon={<FolderOpen size={26} color={colors.gold} />}
                label="Choose from library"
                onPress={() => pick('library')}
              />
            </View>
          ) : null}

          {step === 2 ? (
            <View style={{ gap: spacing['2xl'] }}>
              <Text style={styles.helperText}>
                Help your coach skim their inbox at a glance.
              </Text>
              {COMPOSER_LABELS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    setLabel(opt.value);
                    setStep(3);
                  }}
                  style={({ pressed }) => [
                    styles.tagRow,
                    label === opt.value && styles.tagRowActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Tag size={18} color={label === opt.value ? colors.dark : colors.gold} />
                  <Text
                    style={[
                      styles.tagLabel,
                      { color: label === opt.value ? colors.dark : colors.textOnDark },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  <ChevronRight size={18} color={colors.textLight} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 3 ? (
            <View style={{ gap: spacing['3xl'] }}>
              <View>
                <Text style={styles.fieldLabel}>SEND TO</Text>
                {coachesPending ? (
                  <ActivityIndicator color={colors.gold} />
                ) : !coaches || coaches.length === 0 ? (
                  <Text style={styles.helperText}>
                    No coach is configured at your facility yet.
                  </Text>
                ) : (
                  <View style={{ gap: spacing.base }}>
                    {coaches.map((c) => (
                      <Pressable
                        key={c.userId}
                        onPress={() => setCoachId(c.userId)}
                        style={({ pressed }) => [
                          styles.coachRow,
                          coachId === c.userId && styles.coachRowActive,
                          pressed && { opacity: 0.85 },
                        ]}
                      >
                        <UserIcon
                          size={18}
                          color={coachId === c.userId ? colors.dark : colors.gold}
                        />
                        <Text
                          style={[
                            styles.coachLabel,
                            { color: coachId === c.userId ? colors.dark : colors.textOnDark },
                          ]}
                        >
                          {[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Coach'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.fieldLabel}>CAPTION (OPTIONAL)</Text>
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={500}
                  placeholder="Anything you want your coach to know?"
                  placeholderTextColor={colors.textLight}
                  style={styles.textArea}
                />
              </View>
              <Pressable
                onPress={() => coachId && setStep(4)}
                disabled={!coachId}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  (!coachId || pressed) && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryBtnLabel}>NEXT</Text>
                <ChevronRight size={18} color={colors.dark} />
              </Pressable>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={{ gap: spacing['3xl'] }}>
              <Text style={styles.helperText}>
                Tell your coach who's sending — handy when more than one parent uses the
                same login. Tap a chip or pick "Other" to type a custom name.
              </Text>
              <View>
                <Text style={styles.fieldLabel}>SENT FROM</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.base,
                    marginTop: spacing.base,
                  }}
                >
                  {sentFromOptions.map((opt) => {
                    const active =
                      sentFromMode === 'preset' && senderDisplay === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => {
                          setSentFromMode('preset');
                          setSenderDisplay(opt);
                        }}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.85 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            active && styles.chipLabelActive,
                          ]}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setSentFromMode('custom')}
                    style={({ pressed }) => [
                      styles.chip,
                      sentFromMode === 'custom' && styles.chipActive,
                      pressed && { opacity: 0.85 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sentFromMode === 'custom' }}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        sentFromMode === 'custom' && styles.chipLabelActive,
                      ]}
                    >
                      Other…
                    </Text>
                  </Pressable>
                </View>
                {sentFromMode === 'custom' ? (
                  <TextInput
                    value={customSender}
                    onChangeText={setCustomSender}
                    maxLength={40}
                    placeholder="Type a name (e.g. Grandpa)"
                    placeholderTextColor={colors.textLight}
                    style={[styles.textInput, { marginTop: spacing.lg }]}
                    autoFocus
                  />
                ) : null}
              </View>
              <Pressable
                onPress={onSend}
                disabled={
                  submitting ||
                  (sentFromMode === 'custom' && !customSender.trim()) ||
                  (sentFromMode === 'preset' && !senderDisplay.trim())
                }
                style={({ pressed }) => {
                  const blocked =
                    submitting ||
                    (sentFromMode === 'custom' && !customSender.trim()) ||
                    (sentFromMode === 'preset' && !senderDisplay.trim());
                  return [
                    styles.primaryBtn,
                    pressed && !blocked && { opacity: 0.85 },
                    blocked && { opacity: 0.6 },
                  ];
                }}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.dark} />
                ) : (
                  <Send size={18} color={colors.dark} />
                )}
                <Text style={styles.primaryBtnLabel}>
                  {submitting
                    ? progress != null
                      ? `UPLOADING ${Math.round(progress * 100)}%`
                      : 'SENDING…'
                    : 'SEND TO COACH'}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <View style={styles.stepper}>
      {([1, 2, 3, 4] as Step[]).map((s) => (
        <View
          key={s}
          style={[
            styles.stepDot,
            s <= step ? styles.stepDotActive : styles.stepDotInactive,
          ]}
        />
      ))}
    </View>
  );
}

function BigOption({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing['2xl'],
          paddingHorizontal: spacing['3xl'],
          paddingVertical: spacing['4xl'],
          borderRadius: radius['2xl'],
          borderWidth: 1,
          backgroundColor: primary ? colors.gold : 'transparent',
          borderColor: primary ? colors.gold : colors.borderGold,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      {icon}
      <Text
        style={{
          fontFamily: fontFamilies.oswaldBold,
          fontSize: fontSizes.xl,
          letterSpacing: tracking.wide,
          color: primary ? colors.dark : colors.textOnDark,
        }}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

