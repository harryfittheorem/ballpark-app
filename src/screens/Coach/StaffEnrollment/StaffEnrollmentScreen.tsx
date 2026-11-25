import { usePreventRemove } from '@react-navigation/native';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ChevronLeft, ChevronRight, CreditCard, Eraser, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, PanResponder, Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  canEnrollStaff, completeStaffEnrollment, createEnrollmentIntent, createStaffEnrollment,
  EnrollmentApiError, getEnrollmentOptions, type EnrollmentInput, type EnrollmentIntent, type EnrollmentOptions,
  type EnrollmentResult,
} from '@/api/staffEnrollment';
import { useAuth } from '@/hooks/useAuth';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = CoachInboxStackScreenProps<'StaffEnrollment'>;
type Draft = {
  staffId: string;
  requestId: string;
  input: EnrollmentInput;
  result?: EnrollmentResult;
  // Finalization always uses the root SetupIntent; invoice recovery is separate.
  intent?: EnrollmentIntent;
  billingIntent?: EnrollmentIntent;
  paid?: boolean;
  definitivelyRejected?: boolean;
};
type Fields = Omit<EnrollmentInput, 'waiver_id' | 'signature_image_data'>;
const emptyFields: Fields = {
  parent_first_name: '', parent_last_name: '', parent_email: '', parent_phone: '',
  kid_first_name: '', kid_last_name: '', age_group: '', plan_id: '', location_id: '',
};
const storageKey = (userId: string) => `staff-enrollment:${userId}`;
const steps = ['Family & athlete', 'Plan & location', 'Waiver', 'Payment'];
const ageGroups = ['8U', '10U', '12U', '14U', 'HS', 'College'];

function makeRequestId() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function Field({ label, value, onChangeText, keyboardType, autoCapitalize = 'words' }: {
  label: string; value: string; onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad'; autoCapitalize?: 'none' | 'words';
}) {
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      style={styles.input}
      placeholderTextColor={colors.textMuted}
    />
  </View>;
}

function SheetPresenter({ draft, onSuccess, onCancel, onFailure }: {
  draft: Draft; onSuccess: () => void; onCancel: () => void; onFailure: (message: string) => void;
}) {
  const { initPaymentSheet, presentPaymentSheet, handleNextAction, handleNextActionForSetup, handleURLCallback } = useStripe();
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleURLCallback(url); });
    void Linking.getInitialURL().then(url => { if (url) void handleURLCallback(url); });
    return () => subscription.remove();
  }, [handleURLCallback]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const intent = draft.billingIntent ?? draft.intent!;
        if (intent.payment_status === 'requires_action') {
          // An invoice confirmed off-session may already be awaiting 3DS.
          // Authenticate it rather than trying to re-confirm or replace it.
          const result = intent.intent_type === 'setup'
            ? await handleNextActionForSetup(intent.client_secret, 'ballpark://stripe-redirect')
            : await handleNextAction(intent.client_secret, 'ballpark://stripe-redirect');
          if (!active) return;
          if (result.error?.code === 'Canceled') onCancel();
          else if (result.error) onFailure(result.error.message);
          else onSuccess(); // Server rechecks Stripe before activating.
          return;
        }
        const params = intent.intent_type === 'setup'
          ? { setupIntentClientSecret: intent.client_secret }
          : { paymentIntentClientSecret: intent.client_secret };
        const { error: initError } = await initPaymentSheet({
          ...params,
          merchantDisplayName: 'Clubhouse',
          allowsDelayedPaymentMethods: false,
          returnURL: 'ballpark://stripe-redirect',
        });
        if (initError) throw new Error(initError.message);
        if (!active) return;
        const { error } = await presentPaymentSheet();
        if (!active) return;
        if (error?.code === 'Canceled') onCancel();
        else if (error) onFailure(error.message);
        else onSuccess();
      } catch (error) {
        if (active) onFailure(errorMessage(error));
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => { active = false; };
  }, [draft, handleNextAction, handleNextActionForSetup, initPaymentSheet, onCancel, onFailure, onSuccess, presentPaymentSheet]);
  return <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Opening secure payment…</Text>{!busy && null}</View>;
}

export default function StaffEnrollmentScreen({ navigation }: Props) {
  const { user, session, loading: authLoading } = useAuth();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [options, setOptions] = useState<EnrollmentOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(true);
  const [restoreError, setRestoreError] = useState('');
  const [restoreRevision, setRestoreRevision] = useState(0);
  const [rejectedCreate, setRejectedCreate] = useState(false);
  const [cleanupError, setCleanupError] = useState('');
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [step, setStep] = useState(0);
  const [signaturePaths, setSignaturePaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completedResult, setCompletedResult] = useState<EnrollmentResult | null>(null);
  const signatureRef = useRef<View>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const paymentCheckRef = useRef(false);
  const createdRef = useRef(false);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const restoredMembership = useRef<string | null>(null);

  const updateField = useCallback((key: keyof Fields, value: string) => setFields(old => ({ ...old, [key]: value })), []);
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true); setOptionsError('');
    try { const value = await getEnrollmentOptions(); if (alive.current) setOptions(value); }
    catch (err) { if (alive.current) setOptionsError(errorMessage(err)); }
    finally { if (alive.current) setOptionsLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true;
    if (!authLoading) setAuthorized(!!user && canEnrollStaff(session?.access_token));
    return () => { alive.current = false; };
  }, [authLoading, session?.access_token, user]);
  useEffect(() => { if (authorized) void loadOptions(); }, [authorized, loadOptions, optionsRevision]);

  useEffect(() => {
    if (!user || !authorized) return;
    let active = true;
    setRestoreLoading(true);
    setRestoreError('');
    AsyncStorage.getItem(storageKey(user.id)).then(raw => {
      if (!active) return;
      if (!raw) return;
      const saved = JSON.parse(raw) as Draft;
      if (!saved || saved.staffId !== user.id || !saved.input || !saved.requestId) {
        throw new Error('The saved enrollment is incomplete or belongs to another staff account.');
      }
      // A saved create payload is written immediately before POST; it may have
      // reached the server even when the client never received its response.
      createdRef.current = !saved.definitivelyRejected;
      setRejectedCreate(!!saved.definitivelyRejected);
      setDraft(saved);
      setFields({ ...emptyFields, ...saved.input });
      setStep(saved.result ? 3 : saved.definitivelyRejected ? 0 : 2);
    }).catch(err => {
      if (active) setRestoreError(`Could not restore the saved enrollment. Nothing was changed or overwritten. ${errorMessage(err)}`);
    }).finally(() => {
      if (active) setRestoreLoading(false);
    });
    return () => { active = false; };
  }, [authorized, restoreRevision, user]);

  const dirty = !completed && (!!draft || Object.values(fields).some(Boolean) || signaturePaths.length > 0);
  usePreventRemove(authorized === true && (restoreLoading || paymentReady || checkingPayment || busy || dirty), ({ data }) => {
    if (restoreLoading) {
      Alert.alert('Please wait', 'The saved enrollment is still being restored.');
      return;
    }
    if (busy || paymentReady || checkingPayment) {
      Alert.alert('Please wait', 'Enrollment is being securely processed. Please wait before leaving this screen.');
      return;
    }
    Alert.alert(
      'Leave enrollment?',
      draft?.definitivelyRejected
        ? 'The server declined this request. Its details are saved on this device until you clear them and start a corrected request.'
        : draft
        ? 'Your pending enrollment is saved on this device and can be resumed later.'
        : 'The information entered so far has not been saved. Leaving will discard these entries.',
      [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ],
    );
  });

  const pathResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => signing,
    onMoveShouldSetPanResponder: () => signing,
    onPanResponderGrant: event => {
      const { locationX, locationY } = event.nativeEvent;
      setCurrentPath(`M ${locationX} ${locationY}`);
    },
    onPanResponderMove: event => {
      const { locationX, locationY } = event.nativeEvent;
      setCurrentPath(value => `${value} L ${locationX} ${locationY}`);
    },
    onPanResponderRelease: () => {
      setCurrentPath(value => { if (value.includes(' L ')) setSignaturePaths(paths => [...paths, value]); return ''; });
    },
    onPanResponderTerminate: () => setCurrentPath(''),
  }), [signing]);

  const setBusyState = useCallback((value: boolean) => { busyRef.current = value; setBusy(value); }, []);
  const persist = useCallback(async (next: Draft) => {
    if (!user) return;
    await AsyncStorage.setItem(storageKey(user.id), JSON.stringify(next));
    setDraft(next);
  }, [user]);
  const clearCompletedDraft = useCallback(async () => {
    if (!user) return;
    try {
      await AsyncStorage.removeItem(storageKey(user.id));
      setCleanupError('');
    } catch (err) {
      setCleanupError(`Enrollment is complete, but this device could not remove its saved draft. It will not be charged again. Retry cleanup. ${errorMessage(err)}`);
    }
  }, [user]);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.parent_email.trim());
  const validFamily = fields.parent_first_name.trim() && fields.parent_last_name.trim()
    && validEmail && fields.kid_first_name.trim();
  const selectedLocation = options?.locations.find(location => location.id === fields.location_id);
  const validPlan = fields.plan_id && selectedLocation?.stripe_onboarding_status === 'connected' && options?.waiver;
  const hasSignature = signaturePaths.length > 0;

  const create = async () => {
    const retryingCreate = !!draft && !draft.result;
    if (!retryingCreate && !validFamily) {
      setError(validEmail ? 'Complete the required parent and athlete names.' : 'Enter a valid parent email address before continuing.');
      return;
    }
    if (!retryingCreate && !validPlan) {
      setError('Choose a membership plan and a Stripe-connected location before creating the enrollment.');
      return;
    }
    if (!user || (!retryingCreate && (!options?.waiver || !signatureRef.current || !hasSignature || !agreed)) || busyRef.current) return;
    setError(''); setSigning(false); setBusyState(true);
    try {
      let next: Draft;
      if (retryingCreate && draft) next = draft;
      else {
        const signature = await captureRef(signatureRef, { format: 'png', result: 'base64', quality: 1 });
        const input: EnrollmentInput = {
          ...fields,
          parent_first_name: fields.parent_first_name.trim(),
          parent_last_name: fields.parent_last_name.trim(),
          parent_email: fields.parent_email.trim(),
          kid_first_name: fields.kid_first_name.trim(),
          waiver_id: options!.waiver!.id,
          signature_image_data: `data:image/png;base64,${signature}`,
        };
        next = { staffId: user.id, requestId: makeRequestId(), input };
      }
      await persist(next);
      createdRef.current = true;
      let result = next.result;
      if (!result) {
        try { result = await createStaffEnrollment(next.input, next.requestId); }
        catch (err) {
          const failure = err as { status?: number; message?: string };
          const message = errorMessage(err);
          const normalizedMessage = message.toLowerCase();
          const duplicateAccount = normalizedMessage.includes('an account with email')
            || normalizedMessage.includes('already registered')
            || normalizedMessage.includes('already exists');
          const definitive = failure?.status === 404 || failure?.status === 422
            || (failure?.status === 409 && duplicateAccount);
          if (definitive) {
            const rejectedDraft = { ...next, definitivelyRejected: true };
            setDraft(rejectedDraft);
            setRejectedCreate(true);
            createdRef.current = false;
            setStep(0);
            setSignaturePaths([]);
            setCurrentPath('');
            setAgreed(false);
            setError(`${message} No enrollment was created. Review the details, then sign again to start with a new request.`);
            try { await AsyncStorage.setItem(storageKey(user.id), JSON.stringify(rejectedDraft)); }
            catch (storageError) { setError(`${message} This rejection is definitive; cleanup could not be saved locally. ${errorMessage(storageError)}`); }
            return;
          }
          setError(`${errorMessage(err)} Retry will use the same request so a lost response does not create a duplicate.`);
          return;
        }
        createdRef.current = true;
        next.result = result;
        await persist(next);
      }
      setDraft(next);
      setStep(3);
      restoredMembership.current = result.membership_id;
      await startPayment(next, true, true);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusyState(false); }
  };

  const finish = useCallback(async (next: Draft, alreadyLocked = false) => {
    if (!next.result || !next.intent || (!alreadyLocked && busyRef.current)) return;
    setPaymentReady(false);
    if (!alreadyLocked) setBusyState(true);
    setError('');
    let activated = false;
    try {
      await completeStaffEnrollment(next.result, next.intent);
      activated = true;
      setCompleted(true);
      setCompletedResult(next.result);
      setDraft(null);
    } catch (err) {
      if (err instanceof EnrollmentApiError && err.recoveryIntent) {
        const recoveryDraft: Draft = {
          ...next,
          billingIntent: err.recoveryIntent,
          paid: false,
        };
        setDraft(recoveryDraft);
        try {
          await persist(recoveryDraft);
          setError('Your card was saved, but the first membership payment was not completed. Continue to payment to use another card or authenticate the existing invoice.');
        } catch (persistError) {
          setError(`Your card was saved, but the first membership payment was not completed. Continue to payment to recover it. The recovery details could not be saved locally: ${errorMessage(persistError)}`);
        }
        return;
      }
      const paidDraft = { ...next, paid: true };
      setDraft(paidDraft);
      try { await persist(paidDraft); } catch (persistError) {
        setError(`Payment was accepted, but enrollment activation could not be confirmed. The server payment status will be checked before retry. ${errorMessage(err)} Local save: ${errorMessage(persistError)}`);
        setBusyState(false);
        return;
      }
      setError(`Card setup or payment was accepted, but membership activation could not be confirmed. Retry to check the existing payment; a saved card alone does not mean billing succeeded. ${errorMessage(err)}`);
    } finally {
      setBusyState(false);
    }
    if (activated) await clearCompletedDraft();
  }, [clearCompletedDraft, persist, setBusyState]);
  const startPayment = useCallback(async (saved: Draft, presentAfterCheck = true, alreadyLocked = false) => {
    if (!saved.result || paymentCheckRef.current) return;
    paymentCheckRef.current = true;
    setCheckingPayment(true);
    setError('');
    try {
      // Recheck Stripe after restart or a lost callback before showing a sheet.
      const refreshed = await createEnrollmentIntent(saved.result.membership_id);
      const {
        billing_recovery_intent: billingIntent,
        payment_confirmed: confirmed,
        ...rootIntent
      } = refreshed;
      const next: Draft = {
        ...saved,
        intent: rootIntent,
        billingIntent,
        // A completed SetupIntent only means the card was saved. The invoice
        // is complete only when the server confirms payment for that invoice.
        paid: !!confirmed,
      };
      await persist(next);
      if (next.paid) {
        await finish(next, alreadyLocked);
        return;
      }
      if (presentAfterCheck) {
        if (!options?.stripe_publishable_key) throw new Error('Load enrollment options before opening payment. Please retry loading options.');
        setPaymentReady(true);
      }
    } catch (err) { setError(errorMessage(err)); }
    finally { paymentCheckRef.current = false; setCheckingPayment(false); }
  }, [finish, options?.stripe_publishable_key, persist]);
  const onCancel = useCallback(() => setPaymentReady(false), []);
  const onPaymentError = useCallback((message: string) => { setPaymentReady(false); setError(message); }, []);
  const onPaymentSuccess = useCallback(() => {
    if (!draft) return;
    const paidDraft = { ...draft, paid: true };
    setBusyState(true);
    setPaymentReady(false);
    setDraft(paidDraft);
    void persist(paidDraft)
      .catch(err => setError(`Payment succeeded. The server will be checked before any retry. Local status save failed: ${errorMessage(err)}`))
      .then(() => finish(paidDraft, true));
  }, [draft, finish, persist, setBusyState]);

  useEffect(() => {
    const membershipId = draft?.result?.membership_id;
    if (!authorized || restoreLoading || !membershipId || restoredMembership.current === membershipId) return;
    restoredMembership.current = membershipId;
    void startPayment(draft, false);
  }, [authorized, draft, restoreLoading, startPayment]);

  const discardRejectedDraft = useCallback(async () => {
    if (!user || busyRef.current) return;
    setBusyState(true);
    try {
      await AsyncStorage.removeItem(storageKey(user.id));
      setDraft(null);
      setRejectedCreate(false);
      createdRef.current = false;
      setSignaturePaths([]);
      setCurrentPath('');
      setAgreed(false);
      setError('');
      setStep(0);
    } catch (err) {
      setError(`The rejected request is safe to edit, but its saved copy could not be cleared. Retry this action before continuing. ${errorMessage(err)}`);
    } finally { setBusyState(false); }
  }, [user, setBusyState]);

  if (authLoading || authorized === null) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Checking staff access…</Text></View></SafeAreaView>;
  if (!authorized) return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.title}>Staff access required</Text><Text style={styles.muted}>This enrollment tool is available to authorized Clubhouse owners and admins only.</Text></View></SafeAreaView>;
  if (restoreLoading) return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Checking for a saved enrollment…</Text></View></SafeAreaView>;
  if (restoreError) return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.title}>Enrollment not restored</Text><Text style={styles.error}>{restoreError}</Text><Text style={styles.muted}>Retry storage access before starting another enrollment. Any saved draft will be left untouched.</Text><Pressable onPress={() => setRestoreRevision(value => value + 1)} style={styles.primary}><Text style={styles.primaryText}>Retry restore</Text></Pressable></View></SafeAreaView>;
  if (paymentReady && draft?.intent && !draft.paid) {
    if (Platform.OS === 'web') return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.title}>Native build required</Text><Text style={styles.muted}>Secure payment is not supported on web. Open this enrollment in the Clubhouse iOS or Android app.</Text><Pressable onPress={() => setPaymentReady(false)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Return to enrollment</Text></Pressable></View></SafeAreaView>;
    const sheetIntent = draft.billingIntent ?? draft.intent;
    return <SafeAreaView style={styles.safe}><StripeProvider publishableKey={options?.stripe_publishable_key ?? ''} stripeAccountId={sheetIntent.connected_account_id} urlScheme="ballpark"><SheetPresenter draft={draft} onSuccess={onPaymentSuccess} onCancel={onCancel} onFailure={onPaymentError} /></StripeProvider></SafeAreaView>;
  }

  const selectOptions = (kind: 'plans' | 'locations') => {
    const entries = options?.[kind] ?? [];
    if (!entries.length) return <View style={styles.notice}><Text style={styles.muted}>No {kind} are available right now. Retry loading options or ask an administrator to check setup.</Text><Pressable onPress={() => setOptionsRevision(n => n + 1)}><Text style={styles.link}>Retry options</Text></Pressable></View>;
    return <View style={styles.choiceList}>{entries.map(entry => {
      const chosen = fields[kind === 'plans' ? 'plan_id' : 'location_id'] === entry.id;
      const disconnected = kind === 'locations' && 'stripe_onboarding_status' in entry && entry.stripe_onboarding_status !== 'connected';
      const label = entry.name + (kind === 'plans' && 'amount_cents' in entry ? `  ·  $${(entry.amount_cents / 100).toFixed(2)}${entry.plan_type === 'eft' ? '/mo' : ''}` : '');
      return <Pressable accessibilityRole="radio" accessibilityState={{ selected: chosen, disabled: !!disconnected }} key={entry.id} disabled={!!disconnected} style={[styles.choice, chosen && styles.choiceSelected, disconnected && styles.disabled]} onPress={() => updateField(kind === 'plans' ? 'plan_id' : 'location_id', entry.id)}><View style={{ flex: 1 }}><Text style={[styles.choiceTitle, chosen && styles.choiceTitleSelected]}>{label}</Text>{disconnected ? <Text style={styles.choiceSub}>Stripe payments are not connected for this location.</Text> : 'description' in entry && entry.description ? <Text style={styles.choiceSub}>{entry.description}</Text> : null}</View>{chosen && <Check size={19} color={colors.dark} />}</Pressable>;
    })}</View>;
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}>
    <View style={styles.header}><Pressable disabled={busy} onPress={() => step > 0 && !createdRef.current ? setStep(step - 1) : navigation.goBack()} style={styles.back}><ChevronLeft size={20} color={colors.gold} /><Text style={styles.link}>{step > 0 && !createdRef.current ? 'Back' : 'Close'}</Text></Pressable><Text style={styles.headerTitle}>New family enrollment</Text><Text style={styles.stepCount}>{completed ? 'Done' : `${Math.min(step + 1, 4)} / 4`}</Text></View>
    {completed && completedResult ? <View style={styles.content}><View style={styles.successBadge}><Check color={colors.dark} size={30} /></View><Text style={styles.title}>Family enrolled</Text><Text style={styles.muted}>The welcome and password email will be sent to the parent if email delivery succeeds.</Text><View style={styles.summary}><Text style={styles.summaryTitle}>{fields.parent_first_name} {fields.parent_last_name}</Text><Text style={styles.summaryText}>{fields.kid_first_name} {fields.kid_last_name}</Text><Text style={styles.summaryText}>{options?.plans.find(item => item.id === fields.plan_id)?.name}</Text></View>{cleanupError ? <><Text style={styles.error}>{cleanupError}</Text><Pressable onPress={() => void clearCompletedDraft()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Retry saved-draft cleanup</Text></Pressable></> : null}<Pressable onPress={() => navigation.goBack()} style={styles.primary}><Text style={styles.primaryText}>Done</Text></Pressable></View> :
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={!signing}>
      <View style={styles.progress}>{steps.map((label, index) => <View key={label} style={[styles.progressMark, (index <= step || createdRef.current) && styles.progressMarkActive]} />)}</View>
      {optionsLoading && !options ? <View style={styles.notice}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Loading current plans and waiver…</Text></View> : optionsError && !options ? <View style={styles.notice}><Text style={styles.error}>{optionsError}</Text><Pressable style={styles.secondaryButton} onPress={() => setOptionsRevision(n => n + 1)}><Text style={styles.secondaryText}>Retry</Text></Pressable></View> : null}
      {rejectedCreate && draft ? <><Text style={styles.eyebrow}>REQUEST NOT CREATED</Text><Text style={styles.title}>Review the details</Text><Text style={styles.muted}>{error || 'The server declined this request before creating an enrollment. Correct the details and sign the waiver again to use a new request.'}</Text><Pressable disabled={busy} onPress={() => void discardRejectedDraft()} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Clearing saved request…' : 'Edit details and sign again'}</Text></Pressable></> : null}
      {options && step === 0 && !rejectedCreate ? <><Text style={styles.eyebrow}>STEP 01</Text><Text style={styles.title}>Who are we enrolling?</Text><Text style={styles.muted}>Start with the parent or guardian, then add their athlete.</Text><Field label="Parent first name *" value={fields.parent_first_name} onChangeText={v => updateField('parent_first_name', v)} /><Field label="Parent last name *" value={fields.parent_last_name} onChangeText={v => updateField('parent_last_name', v)} /><Field label="Email address *" value={fields.parent_email} keyboardType="email-address" autoCapitalize="none" onChangeText={v => updateField('parent_email', v)} />{!!fields.parent_email.trim() && !validEmail ? <Text style={styles.error}>Enter a valid email address.</Text> : null}<Field label="Phone (optional)" value={fields.parent_phone ?? ''} keyboardType="phone-pad" onChangeText={v => updateField('parent_phone', v)} /><View style={styles.rule} /><Field label="Athlete first name *" value={fields.kid_first_name} onChangeText={v => updateField('kid_first_name', v)} /><Field label="Athlete last name" value={fields.kid_last_name ?? ''} onChangeText={v => updateField('kid_last_name', v)} /><Text style={styles.sectionTitle}>Age group (optional)</Text><View style={styles.chips}>{ageGroups.map(age => { const selected = fields.age_group === age; return <Pressable key={age} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => updateField('age_group', selected ? '' : age)} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{age}</Text></Pressable>; })}</View></> : null}
      {options && step === 1 ? <><Text style={styles.eyebrow}>STEP 02</Text><Text style={styles.title}>Choose their program</Text><Text style={styles.muted}>Select a membership plan and the home location.</Text><Text style={styles.sectionTitle}>Membership plan</Text>{selectOptions('plans')}<Text style={styles.sectionTitle}>Training location</Text>{selectOptions('locations')}</> : null}
      {options && step === 2 && draft && !draft.result ? <><Text style={styles.eyebrow}>STEP 03</Text><Text style={styles.title}>Almost there!</Text><Text style={styles.muted}>We're picking up right where you left off. This uses the same saved details to avoid creating duplicates. Your signature is preserved until enrollment completes.</Text><Pressable disabled={busy} onPress={() => void create()} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'Processing…' : 'Continue enrollment'}</Text></Pressable></> : options && step === 2 ? <><Text style={styles.eyebrow}>STEP 03</Text><Text style={styles.title}>Review and sign</Text><Text style={styles.muted}>Read the active waiver together. Your signature is captured as an image and attached to this enrollment.</Text>{options.waiver ? <View style={styles.waiver}><View style={styles.waiverTop}><ShieldCheck size={18} color={colors.gold} /><Text style={styles.waiverHeading}>Active waiver · v{options.waiver.version}</Text></View><Text style={styles.waiverDate}>Effective {options.waiver.effective_date}</Text><ScrollView style={styles.waiverBody} nestedScrollEnabled><Text style={styles.waiverText}>{options.waiver.body_text}</Text></ScrollView></View> : <View style={styles.notice}><Text style={styles.error}>No active waiver is available. Enrollment cannot continue until one is configured.</Text><Pressable onPress={() => setOptionsRevision(n => n + 1)}><Text style={styles.link}>Retry</Text></Pressable></View>}<Text style={styles.sectionTitle}>Guardian signature</Text><Text style={styles.muted}>Ask the parent or guardian to sign in the box.</Text><View ref={signatureRef} collapsable={false} style={styles.signatureBox} {...pathResponder.panHandlers}><Svg width="100%" height="100%">{signaturePaths.map((path, index) => <Path key={`${index}-${path.length}`} d={path} stroke={colors.textOnDark} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}{currentPath ? <Path d={currentPath} stroke={colors.textOnDark} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}</Svg>{!hasSignature && !currentPath ? <Text pointerEvents="none" style={styles.signatureHint}>Sign here</Text> : null}</View><View style={styles.signatureActions}><Pressable onPress={() => { setSignaturePaths([]); setCurrentPath(''); }} style={styles.clearButton}><Eraser size={15} color={colors.textLight} /><Text style={styles.clearText}>Clear signature</Text></Pressable><Pressable onPress={() => setSigning(value => !value)} style={[styles.clearButton, signing && styles.signingOn]}><Text style={[styles.clearText, signing && { color: colors.dark }]}>{signing ? 'Finish signing' : 'Sign now'}</Text></Pressable></View><Pressable onPress={() => setAgreed(value => !value)} style={styles.agreement} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}><View style={[styles.checkbox, agreed && styles.checkboxOn]}>{agreed && <Check size={14} color={colors.dark} />}</View><Text style={styles.agreementText}>I confirm that I am the parent or legal guardian and agree to this waiver on behalf of the athlete.</Text></Pressable></> : null}
      {options && step === 3 && draft?.result ? <>
        <Text style={styles.eyebrow}>STEP 04</Text>
        <Text style={styles.title}>{draft.billingIntent ? 'First membership payment' : 'Secure payment'}</Text>
        <Text style={styles.muted}>
          {draft.paid
            ? 'Checking the existing payment before confirming enrollment.'
            : draft.billingIntent
              ? 'Your card is saved, but the first membership payment still needs to be completed. Continue to use another card or authenticate the existing invoice.'
              : 'Continue to Stripe for payment. One-time plans charge the full amount; recurring plans save the card and start monthly billing.'}
        </Text>
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{fields.kid_first_name} {fields.kid_last_name}</Text>
          <Text style={styles.summaryText}>{options.plans.find(plan => plan.id === fields.plan_id)?.name}</Text>
          <Text style={styles.summaryText}>{options.locations.find(location => location.id === fields.location_id)?.name}</Text>
        </View>
        <View style={styles.notice}><CreditCard size={21} color={colors.gold} /><Text style={styles.muted}>Card details are handled by Stripe and are not stored by Clubhouse.</Text></View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {Platform.OS === 'web' && !draft.paid
          ? <View style={styles.notice}><Text style={styles.error}>Native build required. Secure payment is unavailable on web. Open this enrollment in the Clubhouse iOS or Android app to continue.</Text></View>
          : <Pressable disabled={busy || checkingPayment} onPress={() => void startPayment(draft, true)} style={[styles.primary, (busy || checkingPayment) && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Working…' : checkingPayment ? 'Checking payment status…' : draft.billingIntent ? 'Continue to payment' : draft.paid ? 'Recheck and confirm enrollment' : draft.intent ? 'Continue to payment' : 'Retry payment setup'}</Text></Pressable>}
      </> : null}
      {error && step !== 3 && !rejectedCreate ? <Text style={styles.error}>{error}</Text> : null}
      {step < 3 && !rejectedCreate && !(optionsLoading && !options) && options && !(step === 2 && draft && !draft.result) ? <View style={styles.footer}><Pressable disabled={busy || (step === 0 ? !validFamily : step === 1 ? !validPlan : !options.waiver || !hasSignature || !agreed)} onPress={() => { setError(''); if (step === 2) void create(); else setStep(step + 1); }} style={[styles.primary, (busy || (step === 0 ? !validFamily : step === 1 ? !validPlan : !options.waiver || !hasSignature || !agreed)) && styles.disabled]}>{busy ? <ActivityIndicator color={colors.dark} /> : <Text style={styles.primaryText}>{step === 2 ? 'Create enrollment' : 'Continue'}</Text>}{!busy && step < 2 && <ChevronRight size={18} color={colors.dark} />}</Pressable>{step === 2 && <Text style={styles.finePrint}>After creation, details cannot be edited. Payment and confirmation can be retried safely.</Text>}</View> : null}
      {busy && step === 3 ? <View style={styles.notice}><ActivityIndicator color={colors.gold} /><Text style={styles.muted}>Processing enrollment…</Text></View> : null}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing['3xl'], paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { flexDirection: 'row', alignItems: 'center', minWidth: 72, gap: 3 },
  headerTitle: { color: colors.textOnDark, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xl },
  stepCount: { color: colors.textMuted, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm, minWidth: 42, textAlign: 'right' },
  scroll: { flex: 1 },
  content: { padding: spacing['3xl'], paddingBottom: spacing['6xl'], flexGrow: 1 },
  progress: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing['4xl'] },
  progressMark: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: radius.full },
  progressMarkActive: { backgroundColor: colors.gold },
  eyebrow: { color: colors.goldDeep, fontFamily: fontFamilies.interBold, fontSize: fontSizes.xs, letterSpacing: 1.3, marginBottom: spacing.base },
  title: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes['3xl'], marginBottom: spacing.sm },
  muted: { color: colors.textLight, fontFamily: fontFamilies.interMedium, fontSize: fontSizes.md, lineHeight: 21, marginBottom: spacing['2xl'] },
  field: { marginTop: spacing.lg },
  label: { color: colors.textOnDark, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm, marginBottom: spacing.sm },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.darker, borderRadius: radius.lg, color: colors.textOnDark, paddingHorizontal: spacing['2xl'], fontFamily: fontFamilies.interMedium, fontSize: fontSizes.md },
  rule: { borderTopWidth: 1, borderColor: colors.border, marginTop: spacing['3xl'], marginBottom: spacing.sm },
  sectionTitle: { color: colors.textOnDark, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xl, marginTop: spacing['3xl'], marginBottom: spacing.md },
  choiceList: { gap: spacing.md },
  choice: { flexDirection: 'row', alignItems: 'center', padding: spacing['2xl'], gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, backgroundColor: colors.darker },
  choiceSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  choiceTitle: { color: colors.textOnDark, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.md },
  choiceTitleSelected: { color: colors.dark },
  choiceSub: { color: colors.textLight, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.sm, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minWidth: 54, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.darker, borderRadius: radius.full },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.textLight, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm },
  chipTextSelected: { color: colors.dark },
  waiver: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.darker, borderRadius: radius.xl, padding: spacing['2xl'], marginTop: spacing.lg },
  waiverTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  waiverHeading: { color: colors.gold, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg },
  waiverDate: { color: colors.textMuted, fontFamily: fontFamilies.interMedium, fontSize: fontSizes.xs, marginTop: spacing.sm, marginBottom: spacing.lg },
  waiverBody: { maxHeight: 220 },
  waiverText: { color: colors.textOnDark, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.md, lineHeight: 22 },
  signatureBox: { height: 150, borderWidth: 1, borderColor: colors.borderGold, backgroundColor: colors.darker, borderRadius: radius.xl, overflow: 'hidden', marginTop: spacing.md, justifyContent: 'center' },
  signatureHint: { position: 'absolute', alignSelf: 'center', color: colors.textMuted, fontFamily: fontFamilies.interMedium },
  signatureActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  clearButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  clearText: { color: colors.textLight, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm },
  signingOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  agreement: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing['2xl'], marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl },
  checkbox: { width: 21, height: 21, borderWidth: 1, borderColor: colors.textMuted, borderRadius: radius.base, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  agreementText: { flex: 1, color: colors.textOnDark, fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm, lineHeight: 19 },
  footer: { marginTop: spacing['4xl'] },
  primary: { minHeight: 54, paddingHorizontal: spacing['2xl'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.gold, borderRadius: radius.xl, marginTop: spacing.lg },
  primaryText: { color: colors.dark, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.lg, letterSpacing: 0.5, textTransform: 'uppercase' },
  disabled: { opacity: 0.42 },
  finePrint: { textAlign: 'center', color: colors.textMuted, fontFamily: fontFamilies.interRegular, fontSize: fontSizes.xs, lineHeight: 17, marginTop: spacing.md },
  link: { color: colors.gold, fontFamily: fontFamilies.interSemiBold, fontSize: fontSizes.sm },
  notice: { padding: spacing['2xl'], backgroundColor: colors.darker, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, gap: spacing.md, marginVertical: spacing.lg },
  error: { color: colors.danger, fontFamily: fontFamilies.interMedium, fontSize: fontSizes.sm, lineHeight: 20, marginTop: spacing.md },
  secondaryButton: { paddingVertical: spacing.lg, paddingHorizontal: spacing['2xl'], alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.borderGold, borderRadius: radius.lg, marginTop: spacing.md },
  secondaryText: { color: colors.gold, fontFamily: fontFamilies.interSemiBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'], gap: spacing.lg },
  summary: { alignSelf: 'stretch', backgroundColor: colors.darker, borderRadius: radius.xl, padding: spacing['2xl'], marginVertical: spacing['3xl'] },
  summaryTitle: { color: colors.textOnDark, fontFamily: fontFamilies.oswaldBold, fontSize: fontSizes.xl },
  summaryText: { color: colors.textLight, fontFamily: fontFamilies.interMedium, fontSize: fontSizes.md, marginTop: spacing.sm },
  successBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing['2xl'] },
});
