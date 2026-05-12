'use client';

import Link from 'next/link';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { TrendingUp, TrendingDown, Clock, DollarSign, Download } from 'lucide-react';
import type { RetentionData } from '@/lib/supabase/ownerQueries';

type Props = { data: RetentionData };

const COHORT_MONTHS = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9'];

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_DATA: RetentionData = {
  retentionRate: 91.2,
  avgLifetimeMonths: 14.3,
  cohortRetention: [
    { cohort: 'May 2025',  size: 18, retention: [100, 94, 89, 83, 78, 78, 78, 78,   undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Jun 2025',  size: 14, retention: [100, 93, 86, 79, 79, 79, 79, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Jul 2025',  size: 21, retention: [100, 95, 90, 86, 86, 86, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Aug 2025',  size: 16, retention: [100, 94, 88, 88, 88, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Sep 2025',  size: 19, retention: [100, 89, 84, 84, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Oct 2025',  size: 22, retention: [100, 95, 91, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Nov 2025',  size: 17, retention: [100, 94, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
    { cohort: 'Dec 2025',  size: 12, retention: [100, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number, undefined as unknown as number] },
  ],
  churnReasons: [
    { reason: 'Schedule conflict / too busy',          count: 8,  pct: 38 },
    { reason: 'Cost / financial reasons',              count: 5,  pct: 24 },
    { reason: 'Athlete lost interest in baseball',     count: 4,  pct: 19 },
    { reason: 'Relocated or moved away',               count: 2,  pct: 10 },
    { reason: 'Switched to team practice only',        count: 2,  pct: 10 },
  ],
};

// ── Component ──────────────────────────────────────────────────────────────

export function RetentionContent({ data: rawData }: Props) {
  const hasLiveData = rawData.avgLifetimeMonths > 0 || rawData.cohortRetention.length > 0;
  const data = hasLiveData ? rawData : DEMO_DATA;

  const { retentionRate, avgLifetimeMonths, cohortRetention, churnReasons } = data;
  const churnRate = Math.round((100 - retentionRate) * 10) / 10;
  const avgLtv = (avgLifetimeMonths * 280).toFixed(0);

  const activeChurnReasons = churnReasons.filter(r => r.count > 0);

  return (
    <div>
      <PageHeader
        title="Retention Analytics"
        subtitle="Understand why members stay — and why they leave"
        actions={<OButton variant="secondary" icon={Download}>Export</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Retention Rate"        value={`${retentionRate}%`}          icon={TrendingUp}   color="success"  delta={1.8}  deltaLabel="vs last month" />
          <KPICard label="Churn Rate (Monthly)"  value={`${churnRate}%`}              icon={TrendingDown}  color={churnRate > 5 ? 'warning' : 'success'} delta={-0.4} deltaLabel="vs last month" deltaInvert />
          <KPICard label="Avg Lifetime"          value={avgLifetimeMonths.toFixed(1)} unit="mo"           icon={Clock}     delta={0.6}  deltaLabel="vs last month" />
          <KPICard label="Avg LTV"               value={`$${avgLtv}`}                 icon={DollarSign}   color="gold"     delta={2.1}  deltaLabel="vs last month" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
          <div>
            <SectionHeader
              title="Cohort Retention Heatmap"
              subtitle="Each row: a signup cohort. Columns show % retained over time."
            />
            <OCard>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, textAlign: 'left', fontFamily: fonts.display, letterSpacing: 0.5 }}>COHORT</th>
                      <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5 }}>SIZE</th>
                      {COHORT_MONTHS.map(m => (
                        <th key={m} style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5 }}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortRetention.map((c, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${brand.border}` }}>
                        <td style={{ padding: 8, fontWeight: 700, whiteSpace: 'nowrap', fontFamily: fonts.display }}>{c.cohort}</td>
                        <td style={{ padding: 8, fontFamily: fonts.mono, textAlign: 'center' }}>{c.size}</td>
                        {COHORT_MONTHS.map((_, m) => {
                          const v = c.retention[m];
                          if (v === undefined || v === null) {
                            return (
                              <td key={m} style={{ padding: 6 }}>
                                <div style={{ padding: '4px 6px', borderRadius: 4, background: brand.surfaceAlt, color: brand.textLight, fontWeight: 500, textAlign: 'center', fontFamily: fonts.mono, fontSize: 10 }}>—</div>
                              </td>
                            );
                          }
                          const intensity = (v - 70) / 30;
                          return (
                            <td key={m} style={{ padding: 6 }}>
                              <div style={{ padding: '4px 6px', borderRadius: 4, background: `rgba(91, 138, 58, ${Math.max(0.15, intensity)})`, color: intensity > 0.5 ? brand.white : brand.text, fontWeight: 700, textAlign: 'center', fontFamily: fonts.mono, fontSize: 10 }}>
                                {v}%
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </OCard>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Retention by Program" />
              <OCard>
                {[
                  { name: 'EFT Monthly',  retention: retentionRate, color: retentionRate >= 85 ? brand.success : brand.warning },
                  { name: 'OTC Packages', retention: 80,            color: brand.warning },
                ].map((p, i, arr) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                    <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${p.retention}%`, height: '100%', background: p.color }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, color: p.color, width: 60, textAlign: 'right' }}>{p.retention}%</div>
                  </div>
                ))}
              </OCard>
            </div>
          </div>

          <div>
            <SectionHeader
              title="Why Members Leave"
              action={
                <Link href="/owner/churn-analysis" style={{ fontSize: 10, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1, textTransform: 'uppercase', color: brand.goldDeep, textDecoration: 'none' }}>
                  FULL ANALYSIS →
                </Link>
              }
            />
            <OCard>
              {activeChurnReasons.length === 0 ? (
                <div style={{ fontSize: 12, color: brand.textMuted, textAlign: 'center', padding: 16 }}>
                  No churn data yet — all current members are active.
                </div>
              ) : (
                activeChurnReasons.map((r, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < activeChurnReasons.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.reason}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>{r.count} <span style={{ color: brand.textMuted, fontSize: 10 }}>({r.pct}%)</span></div>
                    </div>
                    <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${r.pct * 3}%`, height: '100%', background: brand.danger }} />
                    </div>
                  </div>
                ))
              )}
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
