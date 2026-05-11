'use client';

import { brand } from '@/lib/ownerBrandTokens';
import { KPICard, PageHeader, SectionHeader, OCard, BarChart } from '@/components/owner/ui';
import { TrendingDown, Activity, AlertCircle, Shield, XCircle } from 'lucide-react';
import type { RetentionData } from '@/lib/supabase/ownerQueries';

type Props = { data: RetentionData };

export function ChurnAnalysisContent({ data }: Props) {
  const { retentionRate, churnReasons } = data;
  const monthlyChurn = Math.round((100 - retentionRate) * 10) / 10;
  const annualChurn = Math.round(monthlyChurn * 12 * 10) / 10;

  return (
    <div>
      <PageHeader
        title="Churn Analysis"
        subtitle="Deep dive into why members leave and when"
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Monthly Churn" value={`${monthlyChurn}%`} icon={TrendingDown} color={monthlyChurn < 5 ? 'success' : 'warning'} />
          <KPICard label="Annual Churn" value={`${annualChurn}%`} icon={Activity} color={annualChurn < 20 ? 'success' : 'warning'} />
          <KPICard label="Saves YTD" value="0" deltaLabel="no cancellations" icon={Shield} color="success" />
          <KPICard label="Active Members" value="—" icon={AlertCircle} color="warning" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <OCard>
            <SectionHeader title="Churn by Tenure" subtitle="When do members leave?" />
            <BarChart data={[
              { label: '0-30d', value: 0 }, { label: '1-3mo', value: 0 }, { label: '3-6mo', value: 0 },
              { label: '6-12mo', value: 0 }, { label: '1-2yr', value: 0 }, { label: '2yr+', value: 0 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.infoBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              Churn-by-tenure data will appear as membership history grows.
            </div>
          </OCard>

          <OCard>
            <SectionHeader title="Churn by Age Group" />
            <BarChart data={[
              { label: '8U', value: 0 }, { label: '10U', value: 0 }, { label: '11U', value: 0 },
              { label: '12U', value: 0 }, { label: '13U', value: 0 }, { label: '14U+', value: 0 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              All members are currently active — no churn data to display yet.
            </div>
          </OCard>
        </div>

        <SectionHeader title="Exit Reasons — Detailed" />
        {churnReasons.filter(r => r.count > 0).length === 0 ? (
          <OCard>
            <div style={{ padding: 30, textAlign: 'center' }}>
              <XCircle size={40} color={brand.success} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 700 }}>No churn recorded yet</div>
              <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 6 }}>All current members are active. Exit reasons will appear here when members cancel.</div>
            </div>
          </OCard>
        ) : (
          <OCard>
            {churnReasons.map((r, i) => (
              <div key={i} style={{ padding: '14px 0', borderBottom: i < churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${brand.danger}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <XCircle size={16} color={brand.danger} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.reason}</div>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{r.count} members · {r.pct}% of total churn</div>
                </div>
                <div style={{ width: 200, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct * 3}%`, height: '100%', background: brand.danger }} />
                </div>
              </div>
            ))}
          </OCard>
        )}
      </div>
    </div>
  );
}
