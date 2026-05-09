/**
 * ShareCardScreen — v0.7 task #120.
 *
 * Generates a 9:16 (1080x1920) personal-best / swing share card and lets the
 * parent share it via the OS share sheet, save it to the camera roll, or copy
 * the image to the clipboard.
 *
 * Architecture:
 *   - The card is rendered TWICE in this screen:
 *       1. visible 220px-wide preview, scaled with a Transform so the layout
 *          is identical to the export.
 *       2. off-screen full-resolution version, absolutely positioned at
 *          left=-99999 so it's measured/painted by RN but never visible.
 *     `react-native-view-shot`'s `captureRef` reads from the off-screen view
 *     so the user always exports the full 1080x1920 PNG regardless of how
 *     small the preview is.
 *   - Sharing uses `expo-sharing` (which handles the iOS share sheet & the
 *     Android intent). Save to camera roll uses `expo-media-library`. Copy
 *     uses `expo-clipboard.setImageAsync`. All three are best-effort with
 *     friendly Alerts on failure.
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Copy, Download, Share2, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { useFamily } from '@/hooks/useFamily';
import { usePersonalBestsForKid, useSwing } from '@/hooks/useSwings';
import type { VideosStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies } from '@/theme';
import { errorMessage } from '@/utils/error';

import ShareCardArtwork from './components/ShareCardArtwork';
import { styles } from './styles';

type Route = VideosStackScreenProps<'ShareCard'>['route'];
type Nav = VideosStackScreenProps<'ShareCard'>['navigation'];

const PREVIEW_WIDTH = 220;
const FULL_WIDTH = 1080;
const FULL_HEIGHT = 1920;

export default function ShareCardScreen() {
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { swingId } = route.params;
  const { kids } = useFamily();
  const kid = kids[0] ?? null;

  const { data: swing, isPending, isError, error } = useSwing(swingId);
  const { data: prs } = usePersonalBestsForKid(kid?.id);

  const captureContainerRef = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'share' | 'save' | 'copy'>(null);

  const capture = useCallback(async (): Promise<string> => {
    if (!captureContainerRef.current) {
      throw new Error('Card not ready yet — try again.');
    }
    return await captureRef(captureContainerRef.current, {
      width: FULL_WIDTH,
      height: FULL_HEIGHT,
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
  }, []);

  const onShare = useCallback(async () => {
    setBusy('share');
    try {
      const uri = await capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This device does not expose a share sheet.');
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share PR' });
    } catch (err) {
      Alert.alert('Could not share', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [capture]);

  const onSave = useCallback(async () => {
    setBusy('save');
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Photos access needed',
          'Allow Photos access in Settings to save the share card to your camera roll.',
        );
        return;
      }
      const uri = await capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Share card saved to your camera roll.');
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [capture]);

  const onCopy = useCallback(async () => {
    setBusy('copy');
    try {
      const uri = await capture();
      // expo-clipboard expects a base64 string for setImageAsync.
      // We re-read the captured tmpfile via the React Native fetch + blob path
      // (works in Expo Go without extra deps).
      const res = await fetch(uri);
      const blob = await res.blob();
      const reader = new FileReader();
      const b64: string = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const idx = dataUrl.indexOf(',');
          resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
        };
        reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
        reader.readAsDataURL(blob);
      });
      await Clipboard.setImageAsync(b64);
      Alert.alert('Copied', 'Share card copied — paste into any chat or email.');
    } catch (err) {
      Alert.alert('Could not copy', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }, [capture]);

  if (isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }
  if (isError || !swing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {isError ? errorMessage(error) : 'Swing not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const prMatches = (prs ?? []).filter((p) => p.swing_id === swing.id);
  const kidName = kid ? `${kid.first_name}` : 'Athlete';
  const previewScale = PREVIEW_WIDTH / FULL_WIDTH;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>SHARE CARD</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={22} color={colors.textOnDark} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.previewWrap}>
          <View
            style={{
              width: PREVIEW_WIDTH,
              height: PREVIEW_WIDTH * (FULL_HEIGHT / FULL_WIDTH),
              overflow: 'hidden',
              borderRadius: 18,
            }}
          >
            <View
              style={{
                width: FULL_WIDTH,
                height: FULL_HEIGHT,
                transform: [
                  { translateX: -((FULL_WIDTH - PREVIEW_WIDTH) / 2) },
                  { translateY: -((FULL_HEIGHT - PREVIEW_WIDTH * (FULL_HEIGHT / FULL_WIDTH)) / 2) },
                  { scale: previewScale },
                ],
              }}
            >
              <ShareCardArtwork
                kidName={kidName}
                swing={swing}
                prMetrics={prMatches.map((p) => p.metric)}
              />
            </View>
          </View>
          <Text style={styles.previewCaption}>1080 x 1920 — ready for stories.</Text>
        </View>

        <View style={styles.actions}>
          <ActionRow
            icon={<Share2 size={18} color={colors.dark} />}
            label="Share"
            onPress={onShare}
            primary
            busy={busy === 'share'}
            disabled={busy !== null}
          />
          <ActionRow
            icon={<Download size={18} color={colors.gold} />}
            label="Save to Photos"
            onPress={onSave}
            busy={busy === 'save'}
            disabled={busy !== null}
          />
          <ActionRow
            icon={<Copy size={18} color={colors.gold} />}
            label="Copy image"
            onPress={onCopy}
            busy={busy === 'copy'}
            disabled={busy !== null}
          />
        </View>
      </ScrollView>

      {/* Off-screen full-resolution capture target. Absolutely positioned
          off the visible canvas so RN still measures/paints it but no human
          eye ever sees the 1080-wide version on the phone. */}
      <View
        ref={captureContainerRef}
        collapsable={false}
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: FULL_WIDTH,
          height: FULL_HEIGHT,
        }}
      >
        <ShareCardArtwork
          kidName={kidName}
          swing={swing}
          prMetrics={prMatches.map((p) => p.metric)}
        />
      </View>
    </SafeAreaView>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  primary,
  busy,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  primary?: boolean;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionRow,
        primary ? styles.actionRowPrimary : styles.actionRowSecondary,
        pressed && !disabled && styles.actionRowPressed,
        disabled && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.dark : colors.gold} />
      ) : (
        icon
      )}
      <Text
        style={[
          { fontFamily: fontFamilies.oswaldBold, fontSize: 16, letterSpacing: 1 },
          { color: primary ? colors.dark : colors.gold },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}
