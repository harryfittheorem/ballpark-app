import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

type Props = {
  onPress: () => void;
  onDismiss: () => void;
};

export default function FailedPaymentCard({ onPress, onDismiss }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <AlertTriangle size={22} color="#fff" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Payment failed</Text>
        <Text style={styles.subtitle}>
          Your autopay failed. Tap to update your card.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={(e) => { e.stopPropagation(); onDismiss(); }}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      >
        <X size={16} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c0392b',
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
    gap: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  dismissBtn: {
    flexShrink: 0,
    padding: spacing.xs,
  },
});
