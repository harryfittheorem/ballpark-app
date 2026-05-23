import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';

const HQ_PRIMARY_TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') return null;
  return user;
}

export async function GET() {
  const user = await assertSuperAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient();

  const [tenantsRes, configsRes] = await Promise.all([
    service.from('tenants').select('id, name, slug, royalty_config').order('name'),
    service.from('tenant_config').select('tenant_id, royalty_rate_override, network_logo_url, network_favicon_url'),
  ]);

  const configByTenantId = new Map<string, {
    royalty_rate_override: number | null;
    network_logo_url: string | null;
    network_favicon_url: string | null;
  }>();
  for (const c of (configsRes.data ?? [])) {
    configByTenantId.set(c.tenant_id, {
      royalty_rate_override: c.royalty_rate_override ?? null,
      network_logo_url: c.network_logo_url ?? null,
      network_favicon_url: c.network_favicon_url ?? null,
    });
  }

  const tenants = (tenantsRes.data ?? []).map(t => {
    const cfg = configByTenantId.get(t.id);
    const defaultRate = (t.royalty_config as { rate?: number } | null)?.rate ?? 0.025;
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      royaltyRate: cfg?.royalty_rate_override ?? defaultRate,
    };
  });

  const primaryConfig = configByTenantId.get(HQ_PRIMARY_TENANT_ID) ?? null;
  const settings = {
    network_logo_url: primaryConfig?.network_logo_url ?? null,
    network_favicon_url: primaryConfig?.network_favicon_url ?? null,
  };

  return NextResponse.json({ settings, tenants });
}

export async function PATCH(req: Request) {
  const user = await assertSuperAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json() as {
    type: 'branding' | 'royalty';
    networkLogoUrl?: string | null;
    networkFaviconUrl?: string | null;
    tenantId?: string;
    rate?: number;
  };

  const service = createServiceClient();

  if (body.type === 'branding') {
    const { error } = await service
      .from('tenant_config')
      .upsert(
        {
          tenant_id: HQ_PRIMARY_TENANT_ID,
          network_logo_url: body.networkLogoUrl ?? null,
          network_favicon_url: body.networkFaviconUrl ?? null,
        },
        { onConflict: 'tenant_id' },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.type === 'royalty') {
    if (!body.tenantId || body.rate == null) {
      return NextResponse.json({ error: 'tenantId and rate are required' }, { status: 400 });
    }
    if (body.rate < 0 || body.rate > 1) {
      return NextResponse.json({ error: 'rate must be between 0 and 1' }, { status: 400 });
    }
    const { error } = await service
      .from('tenant_config')
      .upsert(
        { tenant_id: body.tenantId, royalty_rate_override: body.rate },
        { onConflict: 'tenant_id' },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
