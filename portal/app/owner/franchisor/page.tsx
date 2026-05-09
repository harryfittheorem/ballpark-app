'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { DollarSign, Users, TrendingUp, TrendingDown, Download, FileText, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

type LocationRow = typeof demoData.locations[0] & { rank: number };

const locationColumns: TableColumn<LocationRow & Record<string, unknown>>[] = [
  { label: 'Rank', key: 'rank', sortable: true, render: (r) => <span style={{ fontWeight: 800, fontFamily: fonts.display }}>#{r.rank}</span> },
  {
    label: 'Location', key: 'name', sortable: true,
    render: (r) => (
      <div>
        <div style={{ fontWeight: 700 }}>{r.name}</div>
        <div style={{ fontSize: 11, color: brand.textMuted }}>{r.owner}</div>
      </div>
    ),
  },
  { label: 'Members', key: 'members', align: 'right', sortable: true, render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.members}</span> },
  { label: 'MRR', key: 'mrr', align: 'right', sortable: true, render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.mrr / 1000).toFixed(1)}K</span> },
  {
    label: 'Retention', key: 'retention', align: 'right', sortable: true,
    render: (r) => <span style={{ color: r.retention >= 88 ? brand.success : r.retention >= 85 ? brand.warning : brand.danger, fontWeight: 700 }}>{r.retention}%</span>,
  },
  {
    label: 'Risk', key: 'churnRisk',
    render: (r) => <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">{r.churnRisk}</Chip>,
  },
  {
    label: 'Trend', key: 'trend', align: 'right', sortable: true,
    render: (r) => <span style={{ color: r.trend >= 0 ? brand.success : brand.danger, fontWeight: 700 }}>{r.trend >= 0 ? '↑' : '↓'} {Math.abs(r.trend).toFixed(1)}%</span>,
  },
];

export default function FranchisorDashboard() {
  const router = useRouter();
  const k = demoData.networkKPIs;

  const rows = demoData.locations.map((l, i) => ({ ...l, rank: i + 1 }));

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
              rows={rows as unknown as Record<string, unknown>[]}
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
