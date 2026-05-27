/**
 * ScanRedemptionScreen — coach-side QR scanner for fulfilling reward
 * redemptions at the front desk.
 *
 * Flow:
 *   1. Request camera permission (shows a prompt if not yet granted).
 *   2. Live viewfinder — scanning a QR code that contains an 8-char
 *      redemption code (or a URL ending in one) looks up the order.
 *   3. Order detail card — shows the kid name, product, and status.
 *      Coach taps "Mark fulfilled" to close it out.
 *   4. Success state — checkmark with option to scan another.
 *
 * Fallback: a text-entry field beneath the scanner lets staff type the
 * code manually if the QR cannot be read.
 */

import { CameraView, useCameraPermissions } from 'expo-camera';
import { CheckCircle2, QrCode, ScanLine, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
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

import { lookupOrderByRedemptionCode, fulfillRedemption } from '@/api/earn';
import type { OrderWithProduct } from '@/api/earn';
import { Button } from '@/components/ui/Button';
import type { CoachInboxStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = CoachInboxStackScreenProps<'ScanRedemption'>;

type ScreenState =
  | { kind: 'scanning' }
  | { kind: 'loading'; code: string }
  | { kind: 'order'; order: OrderWithProduct; code: string }
  | { kind: 'fulfilling'; order: OrderWithProduct; code: string }
  | { kind: 'success'; order: OrderWithProduct }
  | { kind: 'error'; message: string; code: string };

const STATUS_LABEL: Record<string, string> = {
  ordered: 'Ordered — awaiting pickup',
  fulfilled: 'Already fulfilled',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  payment_failed: 'Payment failed',
};

/** Extract an 8-char alphanumeric code from a raw scan value. */
function extractCode(raw: string): string {
  const trimmed = raw.trim();
  // URL containing the code as the last path segment, e.g. /redeem/ABC12345
  const urlMatch = trimmed.match(/[A-Z0-9]{8}$/i);
  if (urlMatch) return urlMatch[0].toUpperCase();
  return trimmed.toUpperCase();
}

export default function ScanRedemptionScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScreenState>({ kind: 'scanning' });
  const [manualCode, setManualCode] = useState('');
  const scanLockRef = useRef(false);

  const handleCode = useCallback(async (raw: string) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const code = extractCode(raw);
    if (code.length < 6) {
      scanLockRef.current = false;
      return;
    }

    setState({ kind: 'loading', code });
    try {
      const order = await lookupOrderByRedemptionCode(code);
      if (!order) {
        setState({ kind: 'error', message: `No order found for code ${code}.`, code });
      } else {
        setState({ kind: 'order', order, code });
      }
    } catch (err) {
      setState({ kind: 'error', message: errorMessage(err), code });
    }
  }, []);

  const handleFulfill = useCallback(async (order: OrderWithProduct, code: string) => {
    setState({ kind: 'fulfilling', order, code });
    try {
      const updated = await fulfillRedemption(code);
      setState({ kind: 'success', order: { ...order, ...updated } });
    } catch (err) {
      Alert.alert('Could not fulfill', errorMessage(err));
      setState({ kind: 'order', order, code });
    }
  }, []);

  const handleScanAnother = useCallback(() => {
    scanLockRef.current = false;
    setManualCode('');
    setState({ kind: 'scanning' });
  }, []);

  const handleManualLookup = useCallback(() => {
    if (manualCode.trim().length === 0) return;
    handleCode(manualCode.trim());
  }, [manualCode, handleCode]);

  // ── Permission prompt ────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <QrCode size={56} color={colors.gold} style={styles.permIcon} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            Allow camera access so you can scan redemption QR codes at the front desk.
          </Text>
          <Button label="Allow camera" onPress={requestPermission} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state.kind === 'success') {
    const productName = state.order.product?.name ?? 'Unknown product';
    const kidName = state.order.kid
      ? `${state.order.kid.first_name} ${state.order.kid.last_name}`
      : 'Unknown';
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successIcon}>
            <CheckCircle2 size={56} color={colors.gold} />
          </View>
          <Text style={styles.successTitle}>Fulfilled!</Text>
          <Text style={styles.successProduct}>{productName}</Text>
          <Text style={styles.successKid}>{kidName}</Text>
          <View style={styles.successActions}>
            <Button label="Scan another" onPress={handleScanAnother} fullWidth />
            <Button
              label="Done"
              variant="secondary"
              onPress={() => navigation.goBack()}
              fullWidth
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Order detail / fulfilling ────────────────────────────────────────────
  if (state.kind === 'order' || state.kind === 'fulfilling') {
    const { order, code } = state;
    const productName = order.product?.name ?? 'Unknown product';
    const kidName = order.kid
      ? `${order.kid.first_name} ${order.kid.last_name}`
      : 'Unknown';
    const statusLabel = STATUS_LABEL[order.status] ?? order.status;
    const isOrdered = order.status === 'ordered';
    const isFulfilling = state.kind === 'fulfilling';

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.orderContent}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderEyebrow}>Redemption lookup</Text>
            <TouchableOpacity onPress={handleScanAnother} hitSlop={12}>
              <X size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          <View style={styles.orderCard}>
            <Text style={styles.orderProductName}>{productName}</Text>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Kid</Text>
              <Text style={styles.orderValue}>{kidName}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Code</Text>
              <Text style={[styles.orderValue, styles.orderCode]}>{code}</Text>
            </View>
            <View style={styles.orderRow}>
              <Text style={styles.orderLabel}>Status</Text>
              <Text
                style={[
                  styles.orderValue,
                  isOrdered ? styles.statusOrdered : styles.statusOther,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          {isOrdered ? (
            <Button
              label="Mark fulfilled"
              onPress={() => handleFulfill(order, code)}
              loading={isFulfilling}
              fullWidth
            />
          ) : (
            <Text style={styles.alreadyNote}>
              This order cannot be fulfilled again.
            </Text>
          )}

          <TouchableOpacity onPress={handleScanAnother} style={styles.scanAnotherBtn}>
            <ScanLine size={16} color={colors.textLight} />
            <Text style={styles.scanAnotherText}>Scan a different code</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (state.kind === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Order not found</Text>
          <Text style={styles.errorMsg}>{state.message}</Text>
          <Button label="Try again" onPress={handleScanAnother} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state.kind === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>Looking up {state.code}…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Scanning ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.scanHeader}>
          <Text style={styles.scanTitle}>Scan QR Code</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <X size={22} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => handleCode(data)}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.scanFrame} />
          </View>
        </View>

        <View style={styles.manualSection}>
          <Text style={styles.manualLabel}>Or enter code manually</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={(t) => setManualCode(t.toUpperCase())}
              placeholder="e.g. ABC12345"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              returnKeyType="search"
              onSubmitEditing={handleManualLookup}
            />
            <TouchableOpacity
              style={[
                styles.manualBtn,
                manualCode.trim().length === 0 && styles.manualBtnDisabled,
              ]}
              onPress={handleManualLookup}
              disabled={manualCode.trim().length === 0}
            >
              <Text style={styles.manualBtnText}>Look up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FRAME_SIZE = 220;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  flex: { flex: 1 },
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

  // Scanner
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
  cameraWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: radius['2xl'],
    borderWidth: 3,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },

  // Manual entry
  manualSection: {
    padding: spacing['3xl'],
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  manualLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  manualInput: {
    flex: 1,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.lg,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
    color: colors.gold,
    letterSpacing: 4,
  },
  manualBtn: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    paddingHorizontal: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualBtnDisabled: {
    opacity: 0.45,
  },
  manualBtnText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },

  // Loading
  loadingText: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.lg,
  },

  // Order card
  orderContent: {
    padding: spacing['3xl'],
    paddingBottom: spacing['6xl'],
    gap: spacing['2xl'],
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderEyebrow: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: tracking.wider,
  },
  orderCard: {
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['3xl'],
    gap: spacing.lg,
  },
  orderProductName: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderLabel: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  orderValue: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.md,
    color: colors.textOnDark,
  },
  orderCode: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.gold,
    letterSpacing: 3,
  },
  statusOrdered: {
    color: colors.gold,
  },
  statusOther: {
    color: colors.textMuted,
  },
  alreadyNote: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  scanAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  scanAnotherText: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },

  // Success
  successContent: {
    flexGrow: 1,
    padding: spacing['4xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
  },
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
  successProduct: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xl,
    color: colors.textOnDark,
    textAlign: 'center',
  },
  successKid: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
  },
  successActions: {
    width: '100%',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },

  // Error
  errorTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.danger,
    textAlign: 'center',
  },
  errorMsg: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});
