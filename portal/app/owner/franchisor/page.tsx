'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { DollarSign, Users, TrendingUp, TrendingDown, Download, FileText, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

type LocationRow = {
  id: number; name: string; owner: string; members: number;
  mrr: number; retention: number; churnRisk: 'low' | 'medium' | 'high'; trend: number; rank: number;
};

const LOCATIONS: LocationRow[] = [
  { id: 1, name: 'Phoenix', owner: 'Jessica Chen', members: 412, mrr: 118400, retention: 92.8, churnRisk: 'low', trend: 14.8, rank: 1 },
  { id: 2, name: 'Austin C.', owner: 'Sarah Kim', members: 342, mrr: 95800, retention: 91.2, churnRisk: 'low', trend: 11.5, rank: 2 },
  { id: 3, name: 'Atlanta', owner: 'Derek Thompson', members: 321, mrr: 88200, retention: 86.5, churnRisk: 'medium', trend: 3.4, rank: 3 },
  { id: 4, name: 'Dallas N.', owner: 'Mike Patterson', members: 287, mrr: 80360, retention: 89.4, churnRisk: 'low', trend: 8.2, rank: 4 },
  { id: 5, name: 'Houston W.', owner: 'Rob Martinez', members: 298, mrr: 78900, retention: 87.8, churnRisk: 'low', trend: 5.2, rank: 5 },
  { id: 6, name: 'Tampa', owner: 'Melissa Grant', members: 289, mrr: 76500, retention: 88.9, churnRisk: 'low', trend: 7.1, rank: 6 },
  { id: 7, name: 'Dallas S.', owner: 'Jennifer Ford', members: 267, mrr: 71800, retention: 88.1, churnRisk: 'low', trend: 6.7, rank: 7 },
  { id: 8, name: 'Orlando', owner: 'Carlos Ruiz', members: 268, mrr: 71200, retention: 86.7, churnRisk: 'low', trend: 5.4, rank: 8 },
  { id: 9, name: 'San Antonio', owner: 'Marcus Williams', members: 245, mrr: 64200, retention: 85.4, churnRisk: 'medium', trend: 2.1, rank: 9 },
  { id: 10, name: 'Charlotte', owner: 'Brian Lee', members: 234, mrr: 62800, retention: 87.3, churnRisk: 'low', trend: 4.8, rank: 10 },
  { id: 15, name: 'Denver', owner: 'Rachel Kim', members: 187, mrr: 48900, retention: 82.5, churnRisk: 'high', trend: -2.8, rank: 15 },
  { id: 17, name: 'Kansas City', owner: 'Paul Simmons', members: 142, mrr: 36200, retention: 79.8, churnRisk: 'high', trend: -4.1, rank: 17 },
];

const networkKPIs = {
  totalLocations: 17,
  totalMembers: 4892,
  networkMRR: 1387400,
  networkMRRDelta: 6.4,
  avgRetention: 87.1,
  avgChurn: 12.9,
};

const locationColumns: TableColumn<LocationRow & Record<string, unknown>>[] = [
  { label: 'Rank', key: 'rank', sortable: true, render: (r) => <span style={{ fontWeight: 800, fontFamily: fonts.display }}>#{r.rank as number}</span> },
  {
    label: 'Location', key: 'name', sortable: true,
    render: (r) => (
      <div>
        <div style={{ fontWeight: 700 }}>{r.name as string}</div>
        <div style={{ fontSize: 11, color: brand.textMuted }}>{r.owner as string}</div>
      </div>
    ),
  },
  { label: 'Members', key: 'members', align: 'right', sortable: true, render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.members as number}</span> },
  { label: 'MRR', key: 'mrr', align: 'right', sortable: true, render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${((r.mrr as number) / 1000).toFixed(1)}K</span> },
  {
    label: 'Retention', key: 'retention', align: 'right', sortable: true,
    render: (r) => <span style={{ color: (r.retention as number) >= 88 ? brand.success : (r.retention as number) >= 85 ? brand.warning : brand.danger, fontWeight: 700 }}>{r.retention as number}%</span>,
  },
  {
    label: 'Risk', key: 'churnRisk',
    render: (r) => <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">{r.churnRisk as string}</Chip>,
  },
  {
    label: 'Trend', key: 'trend', align: 'right', sortable: true,
    render: (r) => <span style={{ color: (r.trend as number) >= 0 ? brand.success : brand.danger, fontWeight: 700 }}>{(r.trend as number) >= 0 ? '↑' : '↓'} {Math.abs(r.trend as number).toFixed(1)}%</span>,
  },
];

export default function FranchisorDashboard() {
  const router = useRouter();
  const k = networkKPIs;

  return (
    <div>
      <PageHeader
        title="Network Overview"
        subtitle={`${k.totalLocations} locations · ${k.totalMembers.toLocaleString()} members · Strong Q4 momentum`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={FileText}>Generate Report</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Network MRR" value={`$${(k.networkMRR / 1000000).toFixed(2)}M`} delta={k.networkMRRDelta} icon={DollarSign} color="gold" />
          <KPICard label="Total Members" value={k.totalMembers.toLocaleString()} delta={7.2} icon={Users} />
          <KPICard label="Avg Retention" value={`${k.avgRetention}%`} delta={1.4} icon={TrendingUp} color="success" />
          <KPICard label="Network Churn" value={`${k.avgChurn}%`} delta={-0.8} icon={TrendingDown} color="warning" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Location Performance — Ranked" subtitle="Click any row to drill into that location. Sort by any column header." />
            <OTable
              columns={locationColumns as TableColumn<Record<string, unknown>>[]}
              rows={LOCATIONS as unknown as Record<string, unknown>[]}
              onRowClick={(row) => router.push(`/owner/franchisor/${(row as LocationRow).id}`)}
            />
          </div>

          <div>
            <SectionHeader title="Network Alerts" />
            <OCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, background: brand.dangerBg, borderRadius: 8, border: `1px solid ${brand.danger}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertTriangle size={14} color={brand.danger} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Kansas City</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Retention below 80% threshold. 6 months consecutive decline.</div>
                </div>
                <div style={{ padding: 12, background: brand.warningBg, borderRadius: 8, border: `1px solid ${brand.warning}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertCircle size={14} color={brand.warning} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Denver</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>MRR declining 2.8% month-over-month.</div>
                </div>
                <div style={{ padding: 12, background: brand.successBg, borderRadius: 8, border: `1px solid ${brand.success}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <CheckCircle2 size={14} color={brand.success} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Phoenix</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>New monthly record. Up 14.8% vs last month.</div>
                </div>
              </div>
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Royalty Pipeline" />
              <OCard>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>This month</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4 }}>$97,118</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>+ $5,842 vs September</div>
                <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>Auto-collected</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>$92,340 <span style={{ fontSize: 10, color: brand.success }}>(95.1%)</span></div>
                </div>
              </OCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
