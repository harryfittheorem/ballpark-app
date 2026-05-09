'use client';

import { brand } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, PageHeader, SectionHeader, OCard, BarChart } from '@/components/owner/ui';
import { TrendingDown, Activity, AlertCircle, Shield, XCircle } from 'lucide-react';

export default function ChurnAnalysisPage() {
  return (
    <div>
      <PageHeader
        title="Churn Analysis"
        subtitle="Deep dive into why members leave and when"
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Monthly Churn" value="2.1%" delta={-0.4} icon={TrendingDown} color="success" />
          <KPICard label="Annual Churn" value="18.4%" delta={-3.2} icon={Activity} color="success" />
          <KPICard label="Lost Revenue YTD" value="$34,840" icon={AlertCircle} color="warning" />
          <KPICard label="Saves YTD" value="41" deltaLabel="recovered" icon={Shield} color="success" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <OCard>
            <SectionHeader title="Churn by Tenure" subtitle="When do members leave?" />
            <BarChart data={[
              { label: '0-30d', value: 18 }, { label: '1-3mo', value: 24 }, { label: '3-6mo', value: 14 },
              { label: '6-12mo', value: 8 }, { label: '1-2yr', value: 4 }, { label: '2yr+', value: 2 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.warningBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              <strong>Critical insight:</strong> 60% of churn happens in first 90 days. Focus retention efforts on new members.
            </div>
          </OCard>

          <OCard>
            <SectionHeader title="Churn by Age Group" />
            <BarChart data={[
              { label: '8U', value: 14 }, { label: '10U', value: 18 }, { label: '11U', value: 12 },
              { label: '12U', value: 10 }, { label: '13U', value: 8 }, { label: '14U+', value: 6 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              Younger athletes (8-10U) churn more. Often tied to &ldquo;lost interest&rdquo; reason.
            </div>
          </OCard>
        </div>

        <SectionHeader title="Exit Reasons — Detailed" />
        <OCard>
          {demoData.churnReasons.map((r, i) => (
            <div key={i} style={{ padding: '14px 0', borderBottom: i < demoData.churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
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
      </div>
    </div>
  );
}
