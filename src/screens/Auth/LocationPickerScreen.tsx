import React, { useEffect, useState, useCallback } from 'react';
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

import { signUpParent } from '@/api/auth';
import { supabase } from '@/lib/supabase';
import { colors, fontFamilies, fontSizes, spacing } from '@/theme';
import { errorMessage } from '@/utils/error';
import type { AuthStackScreenProps } from '@/navigation/types';

const TENANT_SLUG = process.env.EXPO_PUBLIC_TENANT_SLUG ?? '';

type LocationRow = {
  id: string;
  name: string;
  tenantSlug: string;
  tenantName: string;
  city: string | null;
  state: string | null;
};

type Props = AuthStackScreenProps<'LocationPicker'>;

export default function LocationPickerScreen({ route, navigation }: Props) {
  const { signUpData } = route.params;

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [filtered, setFiltered] = useState<LocationRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLocations() {
      try {
        // In single-tenant builds, resolve the tenant UUID first so we can
        // filter locations to only that tenant's active facilities.
        // Fail-closed: if the tenant slug cannot be resolved, surface an error
        // and do NOT fall back to an unfiltered query.
        let singleTenantId: string | null = null;
        if (TENANT_SLUG) {
          const { data: tenantRows, error: tenantErr } = await supabase
            .from('tenants')
            .select('id')
            .eq('slug', TENANT_SLUG)
            .limit(1);
          if (tenantErr) throw tenantErr;
          singleTenantId = tenantRows?.[0]?.id ?? null;
          if (!singleTenantId) {
            throw new Error('Facility configuration error. Please contact support.');
          }
        }

        // Two queries: locations (anon can read active), then tenants for slugs.
        let locsQuery = supabase
          .from('locations')
          .select('id, name, city, state, tenant_id')
          .order('name');

        if (singleTenantId) {
          locsQuery = locsQuery.eq('tenant_id', singleTenantId);
        }

        const { data: locs, error: locsErr } = await locsQuery;

        if (locsErr) throw locsErr;
        if (!locs || locs.length === 0) {
          setLocations([]);
          setFiltered([]);
          return;
        }

        const tenantIds = [...new Set(locs.map(l => l.tenant_id as string))];
        const { data: tenants, error: tenantsErr } = await supabase
          .from('tenants')
          .select('id, name, slug')
          .in('id', tenantIds);

        if (tenantsErr) throw tenantsErr;

        const tenantMap = new Map<string, { name: string; slug: string }>();
        for (const t of (tenants ?? [])) {
          tenantMap.set(t.id, { name: t.name, slug: t.slug });
        }

        const rows: LocationRow[] = locs.map(l => ({
          id: l.id,
          name: l.name,
          city: l.city ?? null,
          state: l.state ?? null,
          tenantSlug: tenantMap.get(l.tenant_id)?.slug ?? '',
          tenantName: tenantMap.get(l.tenant_id)?.name ?? '',
        }));

        setLocations(rows);
        setFiltered(rows);
      } catch (err) {
        setFetchError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    void fetchLocations();
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    const q = text.toLowerCase();
    setFiltered(
      q
        ? locations.filter(
            l =>
              l.name.toLowerCase().includes(q) ||
              l.tenantName.toLowerCase().includes(q) ||
              (l.city ?? '').toLowerCase().includes(q) ||
              (l.state ?? '').toLowerCase().includes(q),
          )
        : locations,
    );
  }, [locations]);

  async function handleSelect(loc: LocationRow) {
    if (submitting) return;
    if (!loc.tenantSlug) {
      Alert.alert('Error', 'This location is not configured correctly. Please contact support.');
      return;
    }
    setSubmitting(true);
    try {
      await signUpParent({
        email: signUpData.email,
        password: signUpData.password,
        firstName: signUpData.firstName,
        lastName: signUpData.lastName,
        phone: signUpData.phone,
        tenantSlug: loc.tenantSlug,
        locationId: loc.id,
      });
      // Auth state listener in RootNavigator routes the user into the app.
    } catch (err) {
      Alert.alert('Sign-up failed', errorMessage(err));
      setSubmitting(false);
    }
  }

  function renderItem({ item }: { item: LocationRow }) {
    const region = [item.city, item.state].filter(Boolean).join(', ');
    return (
      <TouchableOpacity style={styles.row} onPress={() => void handleSelect(item)} activeOpacity={0.7} disabled={submitting}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>📍</Text>
        </View>
        <View style={styles.rowText}>
          <Text style={styles.locationName}>{item.name}</Text>
          {region ? <Text style={styles.region}>{region}</Text> : null}
          {item.tenantName ? <Text style={styles.tenant}>{item.tenantName}</Text> : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.brand}>CLUBHOUSE</Text>
        <Text style={styles.title}>Choose your location</Text>
        <Text style={styles.subtitle}>Select the facility where you train.</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by city or name…"
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={handleSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : fetchError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{fetchError}</Text>
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

      {submitting && (
        <View style={styles.submittingOverlay}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.submittingText}>Creating your account…</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={submitting}>
          <Text style={styles.backLink}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.darkest },
  header: {
    paddingHorizontal: spacing['4xl'],
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  brand: {
    color: colors.gold,
    fontFamily: fontFamilies.oswaldBold,
    fontSize: fontSizes['4xl'],
    textAlign: 'center',
    marginBottom: spacing['3xl'],
  },
  title: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes['2xl'],
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing['3xl'], marginBottom: spacing.lg,
    backgroundColor: colors.darker, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  searchIcon: { marginRight: spacing.sm, fontSize: 14 },
  searchInput: {
    flex: 1, paddingVertical: 11,
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.darker, borderRadius: 10,
    padding: spacing.lg, marginHorizontal: spacing.lg,
  },
  iconWrap: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: colors.gold + '22',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  iconText: { fontSize: 16 },
  rowText: { flex: 1 },
  locationName: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interBold,
    fontSize: fontSizes.md,
  },
  region: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  tenant: {
    color: colors.gold,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.xs,
    marginTop: 1,
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
  submittingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  submittingText: {
    color: colors.textOnDark,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
    marginTop: spacing.lg,
  },
  footer: { padding: spacing['3xl'], alignItems: 'center' },
  backLink: {
    color: colors.textLight,
    fontFamily: fontFamilies.interRegular,
    fontSize: fontSizes.md,
  },
});
