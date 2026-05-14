import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';

export async function POST(req: Request) {
  // Auth guard: only super_admin can invoke this route.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    isNewTenant: boolean;
    tenantName?: string;
    tenantSlug?: string;
    existingTenantSlug?: string;
    locationName: string;
    city?: string;
    state?: string;
  };

  const { isNewTenant, tenantName, tenantSlug, existingTenantSlug, locationName, city, state } = body;

  if (!locationName) {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();
  let tenantId: string;

  if (isNewTenant) {
    if (!tenantName || !tenantSlug) {
      return NextResponse.json({ error: 'tenantName and tenantSlug are required for a new tenant' }, { status: 400 });
    }

    const { data: existing } = await serviceClient
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();

    if (existing) {
      return NextResponse.json({ error: `Slug "${tenantSlug}" is already taken` }, { status: 409 });
    }

    const { data: newTenant, error: tenantError } = await serviceClient
      .from('tenants')
      .insert({
        name: tenantName,
        slug: tenantSlug,
        brand_colors: {},
        royalty_config: { model: 'per_transaction', rate: 0.025 },
      })
      .select('id')
      .single();

    if (tenantError || !newTenant) {
      return NextResponse.json({ error: tenantError?.message ?? 'Failed to create tenant' }, { status: 500 });
    }
    tenantId = newTenant.id;
  } else {
    if (!existingTenantSlug) {
      return NextResponse.json({ error: 'existingTenantSlug is required' }, { status: 400 });
    }

    const { data: tenant, error } = await serviceClient
      .from('tenants')
      .select('id')
      .eq('slug', existingTenantSlug)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: `Tenant slug "${existingTenantSlug}" not found` }, { status: 400 });
    }
    tenantId = tenant.id;
  }

  const { data: location, error: locationError } = await serviceClient
    .from('locations')
    .insert({
      tenant_id: tenantId,
      name: locationName,
      city: city ?? null,
      state: state ?? null,
      is_active: true,
    })
    .select('id')
    .single();

  if (locationError || !location) {
    return NextResponse.json({ error: locationError?.message ?? 'Failed to create location' }, { status: 500 });
  }

  return NextResponse.json({ success: true, locationId: location.id, tenantId });
}
