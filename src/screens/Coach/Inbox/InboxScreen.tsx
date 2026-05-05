/**
 * Coach Inbox — landing screen for the Inbox tab.
 *
 * v0.4 Step 4.6 only renders the "New Video" entry point; the actual list
 * of conversations lands in a later v0.4 step. The header button and the
 * empty-state CTA both push the RecordVideo screen on the same stack.
 */

import { useNavigation } from '@react-navigation/native';
import { Plus, Video } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';

import type { CoachInboxStackScreenProps } from '@/navigation/types';

type Nav = CoachInboxStackScreenProps<'InboxHome'>['navigation'];

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Record a new video"
          style={styles.headerButton}
          onPress={() => navigation.navigate('RecordVideo')}
        >
          <Plus color={colors.dark} size={16} />
          <Text style={styles.headerButtonText}>New Video</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Video color={colors.gold} size={36} />
        </View>
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptyBody}>
          Send your first video to a family to get the conversation started.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Record a new video"
          style={styles.cta}
          onPress={() => navigation.navigate('RecordVideo')}
        >
          <Plus color={colors.dark} size={18} />
          <Text style={styles.ctaText}>New Video</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.lg,
  },
  title: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    borderRadius: radius.full,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  headerButtonText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.base,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['4xl'],
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.darker,
    borderColor: colors.borderGold,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['3xl'],
  },
  emptyTitle: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['2xl'],
    color: colors.textOnDark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
    marginBottom: spacing.base,
  },
  emptyBody: {
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing['4xl'],
    lineHeight: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    borderRadius: radius.xl,
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['4xl'],
  },
  ctaText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.lg,
    color: colors.dark,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
});
