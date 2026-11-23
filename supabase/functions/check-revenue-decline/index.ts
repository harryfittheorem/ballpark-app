/**
 * check-revenue-decline — Supabase Edge Function (A5)
 *
 * Scheduled daily via pg_cron:
 *   SELECT cron.schedule('check-revenue-decline', '0 8 * * *',
 *     $$SELECT net.http_post(url:='<project-ref>.functions.supabase.co/check-revenue-decline',
 *       headers:='{"Authorization":"Bearer <service-role-key>"}')$$);
 *
 * Logic:
 *   1. For every active tenant, compute MRR for the last 3 completed calendar months.
 *   2. If MRR declined for 2 consecutive months, upsert an owner_notification of kind='revenue_decline'.
 *   3. If the last month recovered, dismiss any existing open alert for that tenant.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async () => {
  try {
    // Fetch active MRR per tenant for last 3 months using payment_events
    const now = new Date();
    const months = [-3, -2, -1].map(offset => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return {
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        start: d.toISOString(),
        end: new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString(),
      };
    });

    // Query payment_events for each month window
    const monthlyData = await Promise.all(
      months.map(m =>
        supabase
          .from('payment_events')
          .select('tenant_id, amount_cents')
          .eq('status', 'paid')
          .gte('created_at', m.start)
          .lt('created_at', m.end)
          .then(({ data }) => ({ month: m.label, data: data ?? [] })),
      ),
    );

    // Aggregate by tenant
    type TenantMrr = { [month: string]: number };
    const byTenant = new Map<string, TenantMrr>();
    for (const { month, data } of monthlyData) {
      for (const row of data) {
        const existing = byTenant.get(row.tenant_id) ?? {};
        existing[month] = (existing[month] ?? 0) + (row.amount_cents ?? 0);
        byTenant.set(row.tenant_id, existing);
      }
    }

    const declineTenants: string[] = [];
    const recoveredTenants: string[] = [];

    for (const [tenantId, mrrMap] of byTenant) {
      const vals = months.map(m => mrrMap[m.label] ?? 0);
      const [m0, m1, m2] = vals; // m0 = 3 months ago, m1 = 2 months ago, m2 = last month
      const twoConsecutiveDeclines = m1 < m0 && m2 < m1 && m0 > 0;
      const recovered = m1 < m0 && m2 > m1 && m0 > 0;
      if (twoConsecutiveDeclines) declineTenants.push(tenantId);
      if (recovered) recoveredTenants.push(tenantId);
    }

    // Upsert decline notifications
    for (const tenantId of declineTenants) {
      const mrrMap = byTenant.get(tenantId)!;
      const vals = months.map(m => mrrMap[m.label] ?? 0);
      const dropPct = vals[0] > 0 ? Math.round(((vals[0] - vals[2]) / vals[0]) * 100) : 0;

      await supabase.from('owner_notifications').upsert({
        tenant_id: tenantId,
        kind: 'revenue_decline',
        title: 'Revenue Decline Alert',
        body: `Your collected revenue has declined for 2 consecutive months (down ~${dropPct}% from ${months[0].label}). Review your at-risk members and consider a re-engagement push.`,
        cta_label: 'View At-Risk Members',
        cta_href: '/owner/at-risk',
        severity: 'critical',
        dismissed: false,
        expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      }, {
        onConflict: 'tenant_id,kind',
        ignoreDuplicates: false,
      }).eq('dismissed', false);
    }

    // Dismiss recovered tenant alerts
    if (recoveredTenants.length > 0) {
      await supabase
        .from('owner_notifications')
        .update({ dismissed: true, dismissed_at: new Date().toISOString(), dismissed_by: 'system' })
        .in('tenant_id', recoveredTenants)
        .eq('kind', 'revenue_decline')
        .eq('dismissed', false);
    }

    return new Response(JSON.stringify({
      ok: true,
      declineAlerts: declineTenants.length,
      dismissed: recoveredTenants.length,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
});
