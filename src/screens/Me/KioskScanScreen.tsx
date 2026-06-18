/**
 * KioskScanScreen — parent scans the HitTrax kiosk QR code to auto-login at
 * the cage.
 *
 * Flow:
 *   1. Camera permission prompt.
 *   2. Live viewfinder — scan a QR code.
 *   3. Client-side validation: must look like a HitTrax kiosk URL.
 *   4. Edge function call (hittrax-kiosk-event).
 *   5. Success card with event-specific message.
 *   6. Error card with retry.
 */

import * as Linking from 'expo-linking';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { CheckCircle2, QrCode, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { useKioskEvent } from '@/hooks/useHitTraxLink';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = MeStackScreenProps<'KioskScan'>;

type ScreenState =
  | { kind: 'scanning' }
  | { kind: 'loading' }
  | { kind: 'success'; eventType: string }
  | { kind: 'error'; message: string };

const FRAME_SIZE = 240;

/** Check whether the raw QR value looks like a HitTrax kiosk event URL. */
function isHitTraxKioskUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    // The kiosk URL must call the NotifyKioskOfUserEvent endpoint
    return url.pathname.toLowerCase().includes('notifykioskofuserevent');
  } catch {
    return false;
  }
}

/** Map raw event_type strings from the edge function to a display label. */
function eventLabel(eventType: string): string {
  const t = eventType.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (t.includes('autologin') || t.includes('login')) return "You're signed in at the kiosk";
  if (t.includes('joinroster') || t.includes('roster')) return 'Added to session roster';
  if (t.includes('jointeam') || t.includes('team')) return 'Added to team session';
  return 'Kiosk notified successfully';
}

export default function KioskScanScreen({ navigation, route }: Props) {
  const { kidId } = route.params;
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScreenState>({ kind: 'scanning' });
  const scanLockRef = useRef(false);
  const kioskEvent = useKioskEvent(kidId);

  const handleScan = useCallback(
    async (raw: string) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;

      if (!isHitTraxKioskUrl(raw)) {
        setState({
          kind: 'error',
          message: "This doesn't look like a HitTrax kiosk QR code. Make sure you scan the QR code displayed on the batting cage kiosk screen.",
        });
        return;
      }

      setState({ kind: 'loading' });
      try {
        const result = await kioskEvent.mutateAsync({ qrUrl: raw });
        setState({ kind: 'success', eventType: result.event_type });
      } catch (err) {
        setState({ kind: 'error', message: errorMessage(err) });
      }
    },
    [kioskEvent],
  );

  const handleRetry = useCallback(() => {
    scanLockRef.current = false;
    setState({ kind: 'scanning' });
  }, []);

  // ── Permission loading ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Permission denied ─────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <QrCode size={56} color={colors.gold} style={styles.permIcon} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Allow camera access so Ballpark can scan the kiosk QR code and sign
            your athlete in at the cage automatically.
          </Text>
          {permission.canAskAgain ? (
            <Button label="Allow camera" onPress={requestPermission} />
          ) : (
            <Button
              label="Open Settings"
              onPress={() => void Linking.openSettings()}
            />
          )}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (state.kind === 'success') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={52} color={colors.gold} />
          </View>
          <Text style={styles.successTitle}>Checked In!</Text>
          <Text style={styles.successBody}>{eventLabel(state.eventType)}</Text>
          <View style={styles.successActions}>
            <Button label="Done" onPress={() => navigation.goBack()} />
            <TouchableOpacity onPress={handleRetry} style={styles.scanAnotherBtn}>
              <Text style={styles.scanAnotherText}>Scan another kiosk</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state.kind === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Scan failed</Text>
          <Text style={styles.errorBody}>{state.message}</Text>
          <Button label="Try again" onPress={handleRetry} />
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Checking in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Scanning ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.scanHeader}>
        <Text style={styles.scanTitle}>Scan Kiosk QR</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <X size={22} color={colors.textLight} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => void handleScan(data)}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scanFrame} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerHint}>
          Point at the QR code displayed on the kiosk screen
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
    gap: spacing['2xl'],
  },

  // Permission
  permIcon: { marginBottom: spacing.lg },
  permTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    textAlign: 'center',
  },
  permBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  cancelBtn: { paddingVertical: spacing.lg },
  cancelText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },

  // Scanner header
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing['2xl'],
  },
  scanTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },

  // Camera
  cameraWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: radius['2xl'],
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['3xl'],
  },
  footerHint: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Loading
  loadingText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.lg,
  },

  // Success
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.borderGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    color: colors.gold,
  },
  successBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  successActions: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  scanAnotherBtn: { paddingVertical: spacing.md },
  scanAnotherText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },

  // Error
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.danger,
    textAlign: 'center',
  },
  errorBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});
