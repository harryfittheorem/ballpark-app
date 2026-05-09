/**
 * ProfileScreen — v0.7 task #122.
 *
 * Replaces the old MeScreen as the Me tab landing surface. Layout:
 *   - Avatar tile (gold, kid's initial), name, subtitle line
 *   - PERSONAL BESTS 2x2 grid (gold numbers; empty -> em-dash)
 *   - ACHIEVEMENTS X/Y, 4-column badge grid (earned in gold, locked dim)
 *   - Settings list: Bookings, Orders, HitTrax, Book a session, Sign out,
 *     Delete account
 *
 * Existing sub-screens (Bookings, Orders, HitTrax, Book) reachable via the
 * settings list. Sign-out + delete-account flows preserved verbatim from
 * the old MeScreen so we don't regress account-lifecycle behaviour.
 */

import {
  Award,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Gauge,
  Gift,
  type LucideIcon,
  LogOut,
  type LucideProps,
  Ruler,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Crown,
  Flame,
  Video,
  GraduationCap,
  BookCheck,
  Activity,
} from 'lucide-react-native';
import { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { deleteAccount } from '@/api/account';
import { signOut } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import {
  useAchievementsCatalog,
  useEarnedAchievements,
} from '@/hooks/useAchievements';
import { useFamily } from '@/hooks/useFamily';
import { useHitTraxLink } from '@/hooks/useHitTraxLink';
import { usePersonalBestsForKid } from '@/hooks/useSwings';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';

type Props = MeStackScreenProps<'MeHome'>;

// Map Postgres icon strings -> lucide icon components. Anything we don't
// recognise falls back to Sparkles so a future catalog entry never breaks
// the grid render.
const ICONS: Record<string, LucideIcon> = {
  Award,
  Sparkles,
  Target,
  Trophy,
  Crown,
  Flame,
  CalendarCheck,
  BookCheck,
  GraduationCap,
  Star,
  Gift,
  Video,
  Activity,
};

const PB_TILES: Array<{
  metric: 'exit_velocity_mph' | 'launch_angle_deg' | 'distance_ft' | 'pitch_speed_mph';
  label: string;
  unit: string;
  icon: LucideIcon;
  digits: number;
}> = [
  { metric: 'exit_velocity_mph', label: 'EXIT VELO',   unit: 'MPH', icon: Gauge,      digits: 1 },
  { metric: 'launch_angle_deg',  label: 'LAUNCH ANGLE', unit: '°',  icon: TrendingUp, digits: 0 },
  { metric: 'distance_ft',       label: 'DISTANCE',    unit: 'FT',  icon: Ruler,      digits: 0 },
  { metric: 'pitch_speed_mph',   label: 'PITCH SPEED', unit: 'MPH', icon: Activity,   digits: 1 },
];

function fmtPb(v: number, digits: number): string {
  if (digits === 0) return Math.round(v).toString();
  return Number(v).toFixed(digits);
}

export default function ProfileScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { family, kids } = useFamily();
  const kid = kids[0] ?? null;

  const { data: hittraxLink } = useHitTraxLink(kid?.id);
  const hittraxStatus =
    hittraxLink?.association_status === 'active'
      ? 'Connected'
      : hittraxLink?.association_status === 'pending'
        ? 'Pending'
        : hittraxLink?.association_status === 'declined'
          ? 'Declined'
          : 'Not connected';

  const { data: prs } = usePersonalBestsForKid(kid?.id);
  const { data: catalog } = useAchievementsCatalog();
  const { data: earned } = useEarnedAchievements(kid?.id);

  const earnedSet = useMemo(
    () => new Set((earned ?? []).map((e) => e.achievement_id)),
    [earned],
  );

  const prsByMetric = useMemo(() => {
    const map = new Map<string, number>();
    (prs ?? []).forEach((p) => map.set(p.metric, Number(p.value)));
    return map;
  }, [prs]);

  const initial = (kid?.first_name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const fullName = kid
    ? `${kid.first_name} ${kid.last_name ?? ''}`.trim()
    : (family
        ? `${family.parent_first_name ?? ''} ${family.parent_last_name ?? ''}`.trim()
        : (user?.email ?? 'Profile'));
  const subtitle = kid
    ? [
        kid.age_group ?? null,
        kid.primary_position ?? null,
        kid.jersey_number ? `#${kid.jersey_number}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || 'Athlete'
    : (user?.email ?? '');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      Alert.alert('Sign-out failed', errorMessage(err));
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      "This permanently deletes your family, your kid's stats, bookings, " +
        'orders, and HitTrax connection. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              await signOut().catch(() => undefined);
            } catch (err) {
              Alert.alert('Could not delete account', errorMessage(err));
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header --------------------------------------------------------- */}
        <View style={styles.header}>
          <View style={styles.avatarTile}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {kid ? (
            <View style={styles.pointsRow}>
              <Trophy size={14} color={colors.gold} />
              <Text style={styles.pointsText}>
                {kid.points_balance.toLocaleString()} pts
              </Text>
            </View>
          ) : null}
        </View>

        {/* Personal Bests ------------------------------------------------- */}
        <Text style={styles.sectionLabel}>PERSONAL BESTS</Text>
        <View style={styles.pbGrid}>
          {PB_TILES.map((tile) => {
            const v = prsByMetric.get(tile.metric);
            const Icon = tile.icon;
            return (
              <View key={tile.metric} style={styles.pbTile}>
                <View style={styles.pbHeader}>
                  <Icon size={14} color={colors.gold} />
                  <Text style={styles.pbLabel}>{tile.label}</Text>
                </View>
                <View style={styles.pbValueRow}>
                  <Text style={styles.pbValue}>
                    {v == null ? '—' : fmtPb(v, tile.digits)}
                  </Text>
                  <Text style={styles.pbUnit}>{tile.unit}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Achievements --------------------------------------------------- */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>ACHIEVEMENTS</Text>
          <Text style={styles.sectionCount}>
            {earnedSet.size}/{(catalog ?? []).length}
          </Text>
        </View>
        <View style={styles.badgeGrid}>
          {(catalog ?? []).map((a) => {
            const Icon = ICONS[a.icon] ?? Sparkles;
            const isEarned = earnedSet.has(a.id);
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.badge, isEarned ? styles.badgeEarned : styles.badgeLocked]}
                onPress={() =>
                  Alert.alert(
                    a.name,
                    isEarned
                      ? `${a.description}\n\n+${a.points_bonus} pts`
                      : `Locked — ${a.description}`,
                  )
                }
              >
                <Icon
                  size={26}
                  color={isEarned ? colors.dark : colors.textMuted}
                  strokeWidth={2.2}
                />
                <Text
                  numberOfLines={2}
                  style={[
                    styles.badgeName,
                    isEarned ? styles.badgeNameEarned : styles.badgeNameLocked,
                  ]}
                >
                  {a.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Settings list -------------------------------------------------- */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <Row
          icon={CalendarCheck}
          label="Book a session"
          onPress={() => navigation.navigate('Book')}
        />
        <Row
          icon={BookOpen}
          label="Bookings"
          onPress={() => navigation.navigate('BookingsList')}
        />
        <Row
          icon={Gift}
          label="Orders"
          onPress={() => navigation.navigate('Orders')}
        />
        <Row
          icon={Activity}
          label="HitTrax"
          subtitle={hittraxStatus}
          subtitleTone={
            hittraxStatus === 'Connected'
              ? 'success'
              : hittraxStatus === 'Pending'
                ? 'gold'
                : hittraxStatus === 'Declined'
                  ? 'light'
                  : 'muted'
          }
          onPress={() => navigation.navigate('ConnectHitTrax')}
        />

        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <LogOut size={16} color={colors.gold} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon: Icon,
  label,
  subtitle,
  subtitleTone = 'muted',
  onPress,
}: {
  icon: (p: LucideProps) => React.ReactNode;
  label: string;
  subtitle?: string;
  subtitleTone?: 'success' | 'gold' | 'light' | 'muted';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon size={18} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? (
          <Text
            style={[
              styles.rowSubtitle,
              subtitleTone === 'success'
                ? { color: colors.success }
                : subtitleTone === 'gold'
                  ? { color: colors.gold }
                  : subtitleTone === 'light'
                    ? { color: colors.textLight }
                    : { color: colors.textMuted },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.gold} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  scroll: { padding: spacing['3xl'], paddingBottom: spacing['7xl'] },

  header: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  avatarTile: {
    width: 92,
    height: 92,
    borderRadius: radius['3xl'],
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  avatarInitial: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: 48,
    color: colors.dark,
  },
  name: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['3xl'],
    color: colors.gold,
  },
  subtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.md,
    color: colors.textLight,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderGold,
    backgroundColor: colors.darker,
  },
  pointsText: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.gold,
    letterSpacing: tracking.wide,
  },

  sectionLabel: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.sm,
    color: colors.gold,
    letterSpacing: tracking.wider,
    textTransform: 'uppercase',
    marginTop: spacing['4xl'],
    marginBottom: spacing.lg,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing['4xl'],
    marginBottom: spacing.lg,
  },
  sectionCount: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes.md,
    color: colors.textLight,
  },

  pbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  pbTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    padding: spacing['2xl'],
  },
  pbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  pbLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },
  pbValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  pbValue: {
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    color: colors.gold,
  },
  pbUnit: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    letterSpacing: tracking.wide,
  },

  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  badge: {
    flexBasis: '22%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
  },
  badgeEarned: {
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  badgeLocked: {
    backgroundColor: colors.darker,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.7,
  },
  badgeName: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  badgeNameEarned: { color: colors.dark },
  badgeNameLocked: { color: colors.textLight },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.darker,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
    marginBottom: spacing.lg,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.darkest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.lg,
    color: colors.textOnDark,
  },
  rowSubtitle: {
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    marginTop: 2,
    letterSpacing: tracking.wide,
    textTransform: 'uppercase',
  },

  signOutBtn: {
    marginTop: spacing['3xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius['2xl'],
    paddingVertical: spacing['2xl'],
  },
  signOutText: {
    color: colors.gold,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.lg,
    textTransform: 'uppercase',
    letterSpacing: tracking.wide,
  },
  deleteBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  deleteText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interMedium,
    fontSize: fontSizes.sm,
    textDecorationLine: 'underline',
  },
});
