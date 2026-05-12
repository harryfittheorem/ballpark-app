'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, PageHeader, SectionHeader, OCard, BarChart } from '@/components/owner/ui';
import { TrendingDown, Activity, DollarSign, Shield, XCircle } from 'lucide-react';
import type { RetentionData } from '@/lib/supabase/ownerQueries';

type Props = { data: RetentionData };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_TENURE_BARS = [
  { label: '0-30d',  value: 8,  highlight: false },
  { label: '1-3mo',  value: 28, highlight: false },
  { label: '3-6mo',  value: 18, highlight: false },
  { label: '6-12mo', value: 42, highlight: true  },
  { label: '1-2yr',  value: 22, highlight: false },
  { label: '2yr+',   value: 5,  highlight: false },
];

const DEMO_AGE_BARS = [
  { label: '8U',   value: 4,  highlight: false },
  { label: '10U',  value: 14, highlight: false },
  { label: '11U',  value: 20, highlight: true  },
  { label: '12U',  value: 18, highlight: false },
  { label: '13U',  value: 22, highlight: false },
  { label: '14U+', value: 12, highlight: false },
];

const DEMO_CHURN_REASONS = [
  { reason: 'Schedule conflict / too busy',       count: 8,  pct: 38 },
  { reason: 'Cost / financial reasons',           count: 5,  pct: 24 },
  { reason: 'Athlete lost interest in baseball',  count: 4,  pct: 19 },
  { reason: 'Relocated or moved away',            count: 2,  pct: 10 },
  { reason: 'Switched to team practice only',     count: 2,  pct: 10 },
];

// ── Component ──────────────────────────────────────────────────────────────

export function ChurnAnalysisContent({ data }: Props) {
  const { retentionRate, churnReasons: rawChurnReasons } = data;
  const monthlyChurn = Math.round((100 - retentionRate) * 10) / 10;
  const annualChurn  = Math.round(monthlyChurn * 12 * 10) / 10;

  const hasLiveData    = rawChurnReasons.some(r => r.count > 0);
  const churnReasons   = hasLiveData ? rawChurnReasons.filter(r => r.count > 0) : DEMO_CHURN_REASONS;

  const lostRevenueYtd = hasLiveData ? churnReasons.reduce((s, r) => s + r.count * 280, 0) : 5880;
  const savesYtd       = hasLiveData ? 0 : 14;

  const tenureBars = hasLiveData ? [
    { label: '0-30d',  value: 0,  highlight: false },
    { label: '1-3mo',  value: 0,  highlight: false },
    { label: '3-6mo',  value: 0,  highlight: false },
    { label: '6-12mo', value: 0,  highlight: false },
    { label: '1-2yr',  value: 0,  highlight: false },
    { label: '2yr+',   value: 0,  highlight: false },
  ] : DEMO_TENURE_BARS;

  const ageBars = hasLiveData ? [
    { label: '8U',   value: 0, highlight: false },
    { label: '10U',  value: 0, highlight: false },
    { label: '11U',  value: 0, highlight: false },
    { label: '12U',  value: 0, highlight: false },
    { label: '13U',  value: 0, highlight: false },
    { label: '14U+', value: 0, highlight: false },
  ] : DEMO_AGE_BARS;

  return (
    <div>
      <PageHeader
        title="Churn Analysis"
        subtitle="Deep dive into why members leave and when"
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Monthly Churn"   value={`${monthlyChurn}%`}                          icon={TrendingDown} color={monthlyChurn < 5 ? 'success' : 'warning'} delta={-0.4} deltaLabel="vs last month" deltaInvert />
          <KPICard label="Annual Churn"    value={`${annualChurn}%`}                            icon={Activity}     color={annualChurn < 20 ? 'success' : 'warning'}  delta={-0.3} deltaLabel="vs last month" deltaInvert />
          <KPICard label="Lost Revenue YTD" value={`$${lostRevenueYtd.toLocaleString()}`}       icon={DollarSign}   color="warning" />
          <KPICard label="Saves YTD"       value={savesYtd}                                    icon={Shield}       color="success" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <OCard>
            <SectionHeader title="Churn by Tenure" subtitle="When do members leave?" />
            <BarChart data={tenureBars} height={180} color={brand.goldDeep} />
            {!hasLiveData && (
              <div style={{ marginTop: 14, padding: 10, background: brand.infoBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
                <strong>Key insight:</strong> The 6–12 month window is your highest-risk period — members who survive past 2 years have very high lifetime retention.
              </div>
            )}
          </OCard>

          <OCard>
            <SectionHeader title="Churn by Age Group" />
            <BarChart data={ageBars} height={180} color={brand.goldDeep} />
            {!hasLiveData && (
              <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
                <strong>Key insight:</strong> 13U athletes have the highest churn — this age group often shifts to school-team-only commitments.
              </div>
            )}
          </OCard>
        </div>

        <SectionHeader title="Exit Reasons — Detailed" />
        <OCard>
          {churnReasons.map((r, i) => (
            <div
              key={i}
              style={{
                padding: '14px 0',
                borderBottom: i < churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none',
                display: 'flex', alignItems: 'center', gap: 16,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: brand.dangerBg, border: `1px solid ${brand.danger}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <XCircle size={18} color={brand.danger} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.body }}>{r.reason}</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>
                  {r.count} {r.count === 1 ? 'member' : 'members'} · {r.pct}% of total churn
                </div>
              </div>
              <div style={{ width: 180, flexShrink: 0 }}>
                <div style={{ height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(r.pct, 100)}%`, height: '100%', background: brand.danger, borderRadius: 4 }} />
                </div>
              </div>
            </div>
          ))}
        </OCard>
      </div>
    </div>
  );
}
