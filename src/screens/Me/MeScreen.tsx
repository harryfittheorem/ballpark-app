import { ChevronRight, Plus } from 'lucide-react-native';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

type Props = MeStackScreenProps<'MeHome'>;

export default function MeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { family, kids } = useFamily();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Sign-out failed', err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Me</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>

        {family ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Family</Text>
            <Text style={styles.cardValue}>
              {family.parent_first_name} {family.parent_last_name}
            </Text>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Kids ({kids.length})</Text>
        </View>

        {kids.map((k) => (
          <TouchableOpacity
            key={k.id}
            style={styles.kidRow}
            onPress={() => navigation.navigate('EditKid', { kidId: k.id })}
          >
            {k.avatar_url ? (
              <Image source={{ uri: k.avatar_url }} style={styles.kidAvatar} />
            ) : (
              <View style={[styles.kidAvatar, styles.kidAvatarPlaceholder]}>
                <Text style={styles.kidAvatarInitial}>
                  {k.first_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.kidInfo}>
              <Text style={styles.kidName}>
                {k.first_name} {k.last_name}
              </Text>
              <Text style={styles.kidMeta}>
                {[k.age_group, k.primary_position, k.jersey_number != null ? `#${k.jersey_number}` : null]
                  .filter(Boolean)
                  .join(' • ') || 'Tap to add details'}
              </Text>
            </View>
            <ChevronRight color={colors.textMuted} size={20} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.addKidBtn}
          onPress={() => navigation.navigate('AddKid')}
        >
          <Plus color={colors.gold} size={18} />
          <Text style={styles.addKidText}>Add another kid</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: { padding: spacing['4xl'], paddingBottom: spacing['6xl'] },
  title: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.sm,
    marginBottom: spacing['4xl'],
  },
  card: {
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing['3xl'],
    marginBottom: spacing['4xl'],
  },
  cardLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  kidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  kidAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.darkest,
    marginRight: spacing['2xl'],
  },
  kidAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.border,
    borderWidth: 1,
  },
  kidAvatarInitial: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.xl,
  },
  kidInfo: { flex: 1 },
  kidName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
  },
  kidMeta: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: spacing.xs,
  },
  addKidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderColor: colors.gold,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    marginTop: spacing.lg,
    marginBottom: spacing['4xl'],
  },
  addKidText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signOutBtn: {
    marginTop: spacing['4xl'],
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  signOutText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
