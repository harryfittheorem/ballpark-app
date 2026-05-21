import { MapPin } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listTenantLocations, type Location } from '@/api/bookings';
import { useAuth } from '@/hooks/useAuth';
import { useFamily } from '@/hooks/useFamily';
import { supabase } from '@/lib/supabase';
import type { MeStackScreenProps } from '@/navigation/types';
import { colors, fontFamilies, fontSizes, radius, spacing, tracking } from '@/theme';
import { errorMessage } from '@/utils/error';
import { useQuery, useQueryClient } from '@tanstack/react-query';

type Props = MeStackScreenProps<'ChangeLocation'>;

export default function ChangeLocationScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { family } = useFamily();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const tenantId = family?.tenant_id ?? null;
  const currentLocationId = family?.primary_location_id ?? null;

  const { data: allLocations, isLoading, error: fetchError } = useQuery<Location[]>({
    queryKey: ['tenant-locations', tenantId ?? 'anonymous'],
    queryFn: listTenantLocations,
    enabled: !!tenantId,
  });

  const filtered = useCallback(() => {
    const list = allLocations ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q) ||
        (l.state ?? '').toLowerCase().includes(q),
    );
  }, [allLocations, search])();

  async function handleSelect(loc: Location) {
    if (saving) return;
    if (loc.id === currentLocationId) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      if (!user) throw new Error('Not authenticated');

      const { error: dbErr } = await supabase
        .from('families')
        .update({ primary_location_id: loc.id })
        .eq('parent_user_id', user.id);

      if (dbErr) throw dbErr;

      // Invariant: refreshSession() is only called after a confirmed DB
      // success — never optimistically. This prevents the session from
      // diverging from the database if the update were to fail silently.
      const { error: sessionErr } = await supabase.auth.refreshSession();
      if (sessionErr) {
        // Session refresh failure is non-fatal: the DB is already updated.
        // The stale JWT will be replaced on next natural refresh cycle.
        console.warn('[ChangeLocation] refreshSession failed:', sessionErr.message);
      }

      // Invalidate family query so the Me screen and Book tab reflect the
      // new location on the very next render after this screen dismisses.
      await qc.invalidateQueries({ queryKey: ['family', user.id] });
      await qc.invalidateQueries({ queryKey: ['location', currentLocationId] });

      navigation.goBack();
    } catch (err) {
      Alert.alert('Update failed', errorMessage(err));
      setSaving(false);
    }
  }

  function renderItem({ item }: { item: Location }) {
    const region = [item.city, item.state].filter(Boolean).join(', ');
    const isCurrent = item.id === currentLocationId;
    return (
      <TouchableOpacity
        style={[styles.row, isCurrent && styles.rowSelected]}
        onPress={() => void handleSelect(item)}
        activeOpacity={0.7}
        disabled={saving}
      >
        <View style={[styles.iconWrap, isCurrent && styles.iconWrapSelected]}>
          <MapPin size={16} color={isCurrent ? colors.dark : colors.gold} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.locationName, isCurrent && styles.locationNameSelected]}>
            {item.name}
          </Text>
          {region ? (
            <Text style={[styles.region, isCurrent && styles.regionSelected]}>{region}</Text>
          ) : null}
        </View>
        {isCurrent ? (
          <Text style={styles.currentBadge}>CURRENT</Text>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by city or name…"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{errorMessage(fetchError)}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={filtered.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No locations match your search.</Text>
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.savingText}>Updating location…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing['3xl'],
    marginBottom: spacing.lg,
    backgroundColor: colors.darker,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  searchIcon: { marginRight: spacing.sm, fontSize: 14 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  list: { paddingHorizontal: spacing['3xl'], paddingBottom: spacing['4xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darker,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  rowSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.gold + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconWrapSelected: {
    backgroundColor: colors.dark + '33',
  },
  rowText: { flex: 1 },
  locationName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
  },
  locationNameSelected: {
    color: colors.dark,
  },
  region: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  regionSelected: {
    color: colors.dark + 'aa',
  },
  currentBadge: {
    fontFamily: fontFamilies.interSemiBold,
    fontSize: fontSizes.xs,
    color: colors.dark,
    letterSpacing: tracking.wider,
  },
  chevron: {
    color: colors.textLight,
    fontSize: 22,
    lineHeight: 28,
    marginLeft: spacing.sm,
  },
  separator: { height: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['4xl'] },
  emptyText: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    textAlign: 'center',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingText: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.lg,
  },
});
