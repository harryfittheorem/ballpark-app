import { createServiceClient } from '@/lib/supabase/serviceClient';
import { HQSettingsContent } from './HQSettingsContent';

const HQ_PRIMARY_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default async function HQSettingsPage() {
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

  return <HQSettingsContent settings={settings} tenants={tenants} />;
}
