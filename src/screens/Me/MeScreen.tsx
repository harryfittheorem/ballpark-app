import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { colors, fontFamilies, fontSizes, radius, spacing } from '@/theme';

export default function MeScreen() {
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
      <View style={styles.container}>
        <Text style={styles.title}>Me</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>

        {family ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Family</Text>
            <Text style={styles.cardValue}>
              {family.parent_first_name} {family.parent_last_name}
            </Text>
            <Text style={styles.cardLabel}>Kids ({kids.length})</Text>
            {kids.map((k) => (
              <Text key={k.id} style={styles.cardValue}>
                • {k.first_name} {k.last_name}
                {k.age_group ? ` — ${k.age_group}` : ''}
              </Text>
            ))}
          </View>
        ) : null}

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  container: { flex: 1, padding: spacing['4xl'] },
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
    marginTop: spacing.lg,
  },
  cardValue: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.lg,
    marginTop: spacing.xs,
  },
  signOutBtn: {
    marginTop: 'auto',
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
