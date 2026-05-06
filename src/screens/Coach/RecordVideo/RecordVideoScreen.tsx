/**
 * RecordVideoScreen — coach-side entry point for sending a new video.
 *
 * Four visual states (see ./types.ts):
 *   idle       Pick: Record New Video / Choose from Library.
 *   preview    Local <Video> playback + Use this video / Pick another.
 *   uploading  UploadProgress + cancel.
 *   errored    Message + Retry / Pick another.
 *
 * Flow:
 *   pick -> show preview -> on confirm, mint Idempotency-Key ->
 *   createMuxUpload (Edge Function) -> uploadVideoToMux PUT to Mux ->
 *   navigate to RecipientPicker with videoId.
 *
 * Idempotency-Key is stable across Retry of the SAME picked file; picking a
 * different file mints a new key. This prevents duplicate `videos` rows
 * when the network flakes mid-upload.
 *
 * Permissions for camera + library are requested via expo-image-picker; on
 * deny we surface a friendly Alert pointing the coach at Settings.
 */

import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FolderOpen } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createMuxUpload } from '@/api/mux';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors } from '@/theme';
import { errorMessage } from '@/utils/error';
import {
  UploadCancelledError,
  uploadVideoToMux,
  type UploadHandle,
} from '@/utils/uploadVideo';
import { uuidv4 } from '@/utils/uuid';

import UploadProgress from './components/UploadProgress';
import VideoPreview from './components/VideoPreview';
import { styles } from './styles';
import type { PickedAsset, RecordVideoState } from './types';

type Nav = CoachInboxStackScreenProps<'RecordVideo'>['navigation'];

type PickerSource = 'camera' | 'library';

export default function RecordVideoScreen() {
  const navigation = useNavigation<Nav>();
  const [state, setState] = useState<RecordVideoState>({ kind: 'idle' });
  const uploadHandleRef = useRef<UploadHandle | null>(null);
  // Per-attempt cancellation flag. Bumped on every new attempt so Cancel can
  // abort the WHOLE flow — including the pre-upload Edge Function call —
  // not just the bytes-in-flight PUT. Without this, tapping Cancel while
  // `createMuxUpload` is still resolving would silently start the PUT and
  // then navigate to RecipientPicker.
  const cancelTokenRef = useRef<{ cancelled: boolean } | null>(null);

  // Cancel any in-flight attempt if the screen unmounts (e.g. coach taps the
  // back arrow mid-upload). Without this the upload keeps streaming and the
  // setState below would warn on an unmounted component.
  useEffect(() => {
    return () => {
      if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true;
      uploadHandleRef.current?.cancel();
      uploadHandleRef.current = null;
    };
  }, []);

  const startUpload = useCallback(
    async (asset: PickedAsset, idempotencyKey: string) => {
      const token = { cancelled: false };
      cancelTokenRef.current = token;
      setState({ kind: 'uploading', asset, progress: 0, idempotencyKey });
      try {
        const { upload_url, video_id } = await createMuxUpload(idempotencyKey);
        if (token.cancelled) return;
        const { promise, handle } = uploadVideoToMux({
          uploadUrl: upload_url,
          fileUri: asset.uri,
          contentType: asset.mimeType,
          onProgress: (fraction) => {
            if (token.cancelled) return;
            setState((prev) =>
              prev.kind === 'uploading' && prev.idempotencyKey === idempotencyKey
                ? { ...prev, progress: fraction }
                : prev,
            );
          },
        });
        uploadHandleRef.current = handle;
        await promise;
        uploadHandleRef.current = null;
        if (token.cancelled) return;
        // Navigate to the placeholder recipient picker with the new video_id.
        // We `replace` so the back button on the picker takes the coach back
        // to the Inbox, not to a stale "100% uploaded" screen.
        navigation.replace('RecipientPicker', { videoId: video_id });
      } catch (err) {
        uploadHandleRef.current = null;
        if (token.cancelled || err instanceof UploadCancelledError) {
          // User-initiated cancel — no error banner.
          return;
        }
        setState({
          kind: 'errored',
          asset,
          idempotencyKey,
          message: errorMessage(err),
        });
      }
    },
    [navigation],
  );

  const handlePick = useCallback(
    async (source: PickerSource) => {
      // Request permissions up-front so we can surface a friendly message
      // when the OS-level prompt is denied (especially on second attempts
      // when the system no longer re-prompts).
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          source === 'camera' ? 'Camera access needed' : 'Photo library access needed',
          source === 'camera'
            ? 'Ballpark needs camera access to record a video. You can enable it in Settings.'
            : 'Ballpark needs photo library access to pick a video. You can enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['videos'],
              videoMaxDuration: 120,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['videos'],
              quality: 1,
            });

      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const asset: PickedAsset = {
        uri: a.uri,
        mimeType: a.mimeType ?? undefined,
        durationSec: a.duration ? a.duration / 1000 : undefined,
      };
      // Show the preview first so the coach can confirm the right clip
      // before any bytes leave the phone. Idempotency key is minted on
      // confirm — a discarded preview never reserves one.
      setState({ kind: 'preview', asset });
    },
    [],
  );

  const handleConfirmPreview = useCallback(() => {
    if (state.kind !== 'preview') return;
    // Fresh pick -> fresh idempotency key. A retry of the SAME pick re-uses
    // the key so the server returns the existing video_id.
    void startUpload(state.asset, uuidv4());
  }, [state, startUpload]);

  const handleCancelUpload = useCallback(() => {
    if (cancelTokenRef.current) cancelTokenRef.current.cancelled = true;
    uploadHandleRef.current?.cancel();
    uploadHandleRef.current = null;
    // Setting idle here is also handled by the catch path; doing it eagerly
    // makes the UI feel instant.
    setState({ kind: 'idle' });
  }, []);

  const handleRetry = useCallback(() => {
    if (state.kind !== 'errored') return;
    void startUpload(state.asset, state.idempotencyKey);
  }, [state, startUpload]);

  const handlePickAnother = useCallback(() => {
    setState({ kind: 'idle' });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        {state.kind === 'idle' ? (
          <IdleView onPick={handlePick} />
        ) : state.kind === 'preview' ? (
          <VideoPreview
            asset={state.asset}
            onConfirm={handleConfirmPreview}
            onPickAnother={handlePickAnother}
          />
        ) : state.kind === 'uploading' ? (
          <View style={styles.uploadingBox}>
            <Text style={styles.uploadingTitle}>Sending your video</Text>
            <Text style={styles.uploadingHint}>
              Keep the app open while it uploads.
            </Text>
            <UploadProgress
              progress={state.progress}
              onCancel={handleCancelUpload}
              cancelLabel="Cancel upload"
            />
          </View>
        ) : (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Upload failed</Text>
            <Text style={styles.errorMessage}>{state.message}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.primaryBtn}
              onPress={handleRetry}
            >
              <Text style={styles.primaryBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryBtn}
              onPress={handlePickAnother}
            >
              <Text style={styles.secondaryBtnText}>Pick another video</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function IdleView({ onPick }: { onPick: (source: PickerSource) => void }) {
  return (
    <View style={styles.idleBox}>
      <Text style={styles.subheading}>
        Record a new clip or pick one from your library. Up next you&apos;ll
        choose which family receives it.
      </Text>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Record new video"
        style={styles.bigButton}
        onPress={() => onPick('camera')}
      >
        <View style={styles.bigButtonIcon}>
          <Camera color={colors.gold} size={24} />
        </View>
        <View style={styles.bigButtonTextWrap}>
          <Text style={styles.bigButtonTitle}>Record New Video</Text>
          <Text style={styles.bigButtonSubtitle}>Use your camera right now.</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Choose video from library"
        style={styles.bigButton}
        onPress={() => onPick('library')}
      >
        <View style={styles.bigButtonIcon}>
          <FolderOpen color={colors.gold} size={24} />
        </View>
        <View style={styles.bigButtonTextWrap}>
          <Text style={styles.bigButtonTitle}>Choose from Library</Text>
          <Text style={styles.bigButtonSubtitle}>
            Pick a video already on your phone.
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
