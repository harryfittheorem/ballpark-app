/**
 * HQ Super-Admin — server-side data fetching layer.
 *
 * All functions accept a Supabase SERVICE client (bypasses RLS) or a
 * super_admin session client (has cross-tenant RLS policies). Data spans
 * ALL tenants — never scoped to a single tenant_id.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type HQLocation = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  name: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  stripeStatus: string;
  stripeAccountName: string | null;
  memberCount: number;
  royaltyRate: number;
};

export type HQTeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'coach' | 'admin' | 'owner' | 'super_admin';
  tenantName: string | null;
  locationName: string | null;
  createdAt: string;
  lastSignIn: string | null;
};

export type HQNetworkKPIs = {
  totalLocations: number;
  totalMembers: number;
  networkMRR: number;
  royaltiesCollected: number;
  locationsNotConnected: number;
};

export type HQLocationRevenue = {
  locationId: string;
  locationName: string;
  tenantName: string;
  mrr: number;
  royalty: number;
  stripeStatus: string;
  memberCount: number;
};

export type HQRecentTransaction = {
  id: string;
  tenantName: string;
  amount: number;
  status: string;
  createdAt: string;
  memberName: string | null;
};

// ─── Locations ───────────────────────────────────────────────────────────────

/**
 * Build a per-location count from rows that have a family_id, using
 * families.primary_location_id as the attribution key.
 *
 * Fallback: for tenants with exactly one location, any family whose
 * primary_location_id is null is attributed to that sole location.
 */
function buildCountByLocation(
  rows: Array<{ family_id: string }>,
  familyLocationMap: Map<string, string | null>,  // family_id → primary_location_id
  locationsByTenant: Map<string, string[]>,        // tenant_id → location ids
  familyTenantMap: Map<string, string>,            // family_id → tenant_id
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const locationId = familyLocationMap.get(row.family_id);
    if (locationId) {
      counts[locationId] = (counts[locationId] ?? 0) + 1;
    } else {
      // Null primary_location_id — fall back to the tenant's sole location.
      const tenantId = familyTenantMap.get(row.family_id);
      if (tenantId) {
        const locs = locationsByTenant.get(tenantId) ?? [];
        if (locs.length === 1) {
          counts[locs[0]] = (counts[locs[0]] ?? 0) + 1;
        }
        // Multi-location tenant with unattributed family: omit to avoid duplication.
      }
    }
  }
  return counts;
}

export async function getHQLocations(supabase: SupabaseClient): Promise<HQLocation[]> {
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, tenant_id, name, city, state, is_active, stripe_onboarding_status, stripe_account_name')
    .order('name');

  if (error || !locations) return [];

  const tenantIds = [...new Set(locations.map(l => l.tenant_id))];

  const [tenantsRes, membershipsRes, familiesRes] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, royalty_config').in('id', tenantIds),
    supabase.from('memberships').select('family_id').in('tenant_id', tenantIds).eq('status', 'active'),
    supabase.from('families').select('id, tenant_id, primary_location_id').in('tenant_id', tenantIds),
  ]);

  const tenantMap = new Map<string, { name: string; slug: string; royaltyRate: number }>();
  for (const t of (tenantsRes.data ?? [])) {
    const rc = t.royalty_config as { rate?: number } | null;
    tenantMap.set(t.id, { name: t.name, slug: t.slug, royaltyRate: rc?.rate ?? 0.025 });
  }

  // Build family lookup maps.
  const familyLocationMap = new Map<string, string | null>();
  const familyTenantMap = new Map<string, string>();
  for (const f of (familiesRes.data ?? [])) {
    familyLocationMap.set(f.id, f.primary_location_id ?? null);
    familyTenantMap.set(f.id, f.tenant_id);
  }

  // Build locations-by-tenant map (for fallback attribution).
  const locationsByTenant = new Map<string, string[]>();
  for (const l of locations) {
    const existing = locationsByTenant.get(l.tenant_id) ?? [];
    existing.push(l.id);
    locationsByTenant.set(l.tenant_id, existing);
  }

  const memberCountByLocation = buildCountByLocation(
    membershipsRes.data ?? [],
    familyLocationMap,
    locationsByTenant,
    familyTenantMap,
  );

  return locations.map(l => {
    const tenant = tenantMap.get(l.tenant_id);
    return {
      id: l.id,
      tenantId: l.tenant_id,
      tenantName: tenant?.name ?? '—',
      tenantSlug: tenant?.slug ?? '',
      name: l.name,
      city: l.city ?? null,
      state: l.state ?? null,
      isActive: l.is_active ?? true,
      stripeStatus: l.stripe_onboarding_status ?? 'not_connected',
      stripeAccountName: l.stripe_account_name ?? null,
      memberCount: memberCountByLocation[l.id] ?? 0,
      royaltyRate: tenant?.royaltyRate ?? 0.025,
    };
  });
}

// ─── Team ────────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  raw_user_meta_data: {
    app_role?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    tenant_slug?: string;
  };
};

/**
 * Fetch all auth users via the Supabase Admin REST API.
 * Returns up to 1000 users (sufficient for any current franchise network).
 */
async function fetchAdminUsers(): Promise<AdminUser[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const res = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const body = await res.json() as { users?: AdminUser[] };
    return body.users ?? [];
  } catch {
    return [];
  }
}

export async function getHQTeam(supabase: SupabaseClient): Promise<HQTeamMember[]> {
  const [coachesRes, superAdminsRes, tenantsRes, locationsRes, adminUsers] = await Promise.all([
    supabase
      .from('coaches')
      .select('id, user_id, first_name, last_name, is_active, created_at, tenant_id, primary_location_id')
      .eq('is_active', true),
    supabase
      .from('super_admins')
      .select('id, user_id, name, email, created_at'),
    supabase.from('tenants').select('id, name, slug'),
    supabase.from('locations').select('id, name'),
    fetchAdminUsers(),
  ]);

  const tenantBySlug = new Map<string, { id: string; name: string }>();
  const tenantById = new Map<string, string>();
  for (const t of (tenantsRes.data ?? [])) {
    tenantBySlug.set(t.slug, { id: t.id, name: t.name });
    tenantById.set(t.id, t.name);
  }

  const locationMap = new Map<string, string>();
  for (const l of (locationsRes.data ?? [])) locationMap.set(l.id, l.name);

  // Build a lookup of user_id → auth user metadata for last_sign_in_at / email.
  const authUserMap = new Map<string, AdminUser>();
  for (const u of adminUsers) authUserMap.set(u.id, u);

  // Super-admins from super_admins table.
  const superAdmins: HQTeamMember[] = (superAdminsRes.data ?? []).map(sa => {
    const au = authUserMap.get(sa.user_id);
    return {
      id: sa.id,
      userId: sa.user_id,
      name: sa.name,
      email: sa.email,
      role: 'super_admin' as const,
      tenantName: null,
      locationName: null,
      createdAt: sa.created_at ?? new Date().toISOString(),
      lastSignIn: au?.last_sign_in_at ?? null,
    };
  });

  // Coaches from coaches table (supplement email + lastSignIn from auth).
  const coaches: HQTeamMember[] = (coachesRes.data ?? []).map(c => {
    const au = authUserMap.get(c.user_id);
    return {
      id: c.id,
      userId: c.user_id,
      name: `${c.first_name} ${c.last_name}`,
      email: au?.email ?? '',
      role: 'coach' as const,
      tenantName: tenantById.get(c.tenant_id) ?? null,
      locationName: c.primary_location_id ? (locationMap.get(c.primary_location_id) ?? null) : null,
      createdAt: c.created_at ?? new Date().toISOString(),
      lastSignIn: au?.last_sign_in_at ?? null,
    };
  });

  // Owners and admins: these are portal-only roles with no dedicated profile table.
  // Pull from auth.users Admin API and filter by app_role in metadata.
  const superAdminUserIds = new Set((superAdminsRes.data ?? []).map(sa => sa.user_id));
  const coachUserIds = new Set((coachesRes.data ?? []).map(c => c.user_id));

  const portalRoles: HQTeamMember[] = adminUsers
    .filter(u => {
      const role = u.raw_user_meta_data?.app_role;
      return (role === 'owner' || role === 'admin') &&
        !superAdminUserIds.has(u.id) &&
        !coachUserIds.has(u.id);
    })
    .map(u => {
      const meta = u.raw_user_meta_data;
      const role = (meta?.app_role ?? 'admin') as 'owner' | 'admin';
      const firstName = meta?.first_name ?? '';
      const lastName = meta?.last_name ?? '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || u.email;
      const tenantSlug = meta?.tenant_slug ?? '';
      const tenant = tenantBySlug.get(tenantSlug);
      return {
        id: u.id,
        userId: u.id,
        name,
        email: u.email,
        role,
        tenantName: tenant?.name ?? null,
        locationName: null,
        createdAt: u.created_at,
        lastSignIn: u.last_sign_in_at ?? null,
      };
    });

  // Sort by role priority, then name.
  const rolePriority = { super_admin: 0, owner: 1, admin: 2, coach: 3 };
  return [...superAdmins, ...portalRoles, ...coaches].sort((a, b) => {
    const rp = rolePriority[a.role] - rolePriority[b.role];
    if (rp !== 0) return rp;
    return a.name.localeCompare(b.name);
  });
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export async function getHQNetworkKPIs(supabase: SupabaseClient): Promise<HQNetworkKPIs> {
  const [locationsRes, membershipsRes, tenantsRes, paymentsRes] = await Promise.all([
    supabase.from('locations').select('id, stripe_onboarding_status'),
    supabase.from('memberships').select('tenant_id, amount_cents, status').eq('status', 'active'),
    supabase.from('tenants').select('id, royalty_config'),
    supabase
      .from('payment_events')
      .select('tenant_id, amount_cents, status')
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
  ]);

  const locations = locationsRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const tenants = tenantsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const royaltyByTenant = new Map<string, number>();
  for (const t of tenants) {
    const rc = t.royalty_config as { rate?: number } | null;
    royaltyByTenant.set(t.id, rc?.rate ?? 0.025);
  }

  const networkMRR = memberships.reduce((s, m) => s + (m.amount_cents ?? 0), 0) / 100;

  const royaltiesCollected = payments.reduce((s, p) => {
    const rate = royaltyByTenant.get(p.tenant_id) ?? 0.025;
    return s + ((p.amount_cents ?? 0) * rate);
  }, 0) / 100;

  return {
    totalLocations: locations.length,
    totalMembers: memberships.length,
    networkMRR,
    royaltiesCollected: Math.round(royaltiesCollected * 100) / 100,
    locationsNotConnected: locations.filter(l => l.stripe_onboarding_status !== 'connected').length,
  };
}

export async function getHQLocationRevenue(supabase: SupabaseClient): Promise<HQLocationRevenue[]> {
  const [locationsRes, tenantsRes, membershipsRes, paymentsRes, familiesRes] = await Promise.all([
    supabase.from('locations').select('id, tenant_id, name, stripe_onboarding_status'),
    supabase.from('tenants').select('id, name, royalty_config'),
    supabase.from('memberships').select('family_id, tenant_id, amount_cents').eq('status', 'active'),
    supabase
      .from('payment_events')
      .select('family_id, tenant_id, amount_cents')
      .eq('status', 'paid')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase.from('families').select('id, tenant_id, primary_location_id'),
  ]);

  const tenantMap = new Map<string, { name: string; royaltyRate: number }>();
  for (const t of (tenantsRes.data ?? [])) {
    const rc = t.royalty_config as { rate?: number } | null;
    tenantMap.set(t.id, { name: t.name, royaltyRate: rc?.rate ?? 0.025 });
  }

  // Build family lookup maps for per-location attribution.
  const familyLocationMap = new Map<string, string | null>();
  const familyTenantMap = new Map<string, string>();
  for (const f of (familiesRes.data ?? [])) {
    familyLocationMap.set(f.id, f.primary_location_id ?? null);
    familyTenantMap.set(f.id, f.tenant_id);
  }

  const locations = locationsRes.data ?? [];
  const locationsByTenant = new Map<string, string[]>();
  for (const l of locations) {
    const existing = locationsByTenant.get(l.tenant_id) ?? [];
    existing.push(l.id);
    locationsByTenant.set(l.tenant_id, existing);
  }

  // Per-location MRR: attribute membership amount_cents to the family's primary location.
  const mrrByLocation: Record<string, number> = {};
  for (const m of (membershipsRes.data ?? [])) {
    const locationId = familyLocationMap.get(m.family_id);
    if (locationId) {
      mrrByLocation[locationId] = (mrrByLocation[locationId] ?? 0) + (m.amount_cents ?? 0);
    } else {
      const tenantId = familyTenantMap.get(m.family_id) ?? m.tenant_id;
      const locs = locationsByTenant.get(tenantId) ?? [];
      if (locs.length === 1) {
        mrrByLocation[locs[0]] = (mrrByLocation[locs[0]] ?? 0) + (m.amount_cents ?? 0);
      }
    }
  }

  // Per-location paid amount: same attribution via family_id.
  const paidByLocation: Record<string, number> = {};
  for (const p of (paymentsRes.data ?? [])) {
    const locationId = familyLocationMap.get(p.family_id);
    if (locationId) {
      paidByLocation[locationId] = (paidByLocation[locationId] ?? 0) + (p.amount_cents ?? 0);
    } else {
      const tenantId = familyTenantMap.get(p.family_id) ?? p.tenant_id;
      const locs = locationsByTenant.get(tenantId) ?? [];
      if (locs.length === 1) {
        paidByLocation[locs[0]] = (paidByLocation[locs[0]] ?? 0) + (p.amount_cents ?? 0);
      }
    }
  }

  // Per-location member count (count of active memberships, same attribution).
  const memberCountByLocation = buildCountByLocation(
    membershipsRes.data ?? [],
    familyLocationMap,
    locationsByTenant,
    familyTenantMap,
  );

  return locations.map(l => {
    const tenant = tenantMap.get(l.tenant_id);
    const mrr = (mrrByLocation[l.id] ?? 0) / 100;
    const paid = (paidByLocation[l.id] ?? 0) / 100;
    const royaltyRate = tenant?.royaltyRate ?? 0.025;
    return {
      locationId: l.id,
      locationName: l.name,
      tenantName: tenant?.name ?? '—',
      mrr,
      royalty: Math.round(paid * royaltyRate * 100) / 100,
      stripeStatus: l.stripe_onboarding_status ?? 'not_connected',
      memberCount: memberCountByLocation[l.id] ?? 0,
    };
  }).sort((a, b) => b.mrr - a.mrr);
}

export async function getHQRecentTransactions(supabase: SupabaseClient, limit = 20): Promise<HQRecentTransaction[]> {
  const { data, error } = await supabase
    .from('payment_events')
    .select('id, tenant_id, amount_cents, status, created_at, membership_id')
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const tenantIds = [...new Set(data.map(p => p.tenant_id))];
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .in('id', tenantIds);

  const tenantMap = new Map<string, string>();
  for (const t of (tenants ?? [])) tenantMap.set(t.id, t.name);

  return data.map(p => ({
    id: p.id,
    tenantName: tenantMap.get(p.tenant_id) ?? '—',
    amount: (p.amount_cents ?? 0) / 100,
    status: p.status,
    createdAt: p.created_at,
    memberName: null,
  }));
}
