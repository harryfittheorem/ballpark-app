'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { TrendingUp, TrendingDown, Clock, DollarSign, Download } from 'lucide-react';
import type { RetentionData } from '@/lib/supabase/ownerQueries';

type Props = { data: RetentionData };

export function RetentionContent({ data }: Props) {
  const router = useRouter();
  const { retentionRate, avgLifetimeMonths, cohortRetention, churnReasons } = data;
  const churnRate = Math.round((100 - retentionRate) * 10) / 10;

  return (
    <div>
      <PageHeader
        title="Retention Analytics"
        subtitle="Understand why members stay — and why they leave"
        actions={<OButton variant="secondary" icon={Download}>Export</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Retention Rate" value={`${retentionRate}%`} icon={TrendingUp} color="success" />
          <KPICard label="Churn Rate" value={`${churnRate}%`} icon={TrendingDown} color={churnRate > 5 ? 'warning' : 'success'} />
          <KPICard label="Avg Lifetime" value={avgLifetimeMonths.toFixed(1)} unit="mo" icon={Clock} />
          <KPICard label="Total Members" value="—" icon={DollarSign} color="gold" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            {cohortRetention.length > 0 ? (
              <>
                <SectionHeader title="Cohort Retention" subtitle="Each row: a signup cohort. Columns show % retained over time." />
                <OCard>
                  <div style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, textAlign: 'left' }}>COHORT</th>
                          <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>SIZE</th>
                          <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>M0</th>
                          <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>CURRENT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohortRetention.map((c, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${brand.border}` }}>
                            <td style={{ padding: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.cohort}</td>
                            <td style={{ padding: 8, fontFamily: fonts.mono, textAlign: 'center' }}>{c.size}</td>
                            {c.retention.map((v, m) => {
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
              </>
            ) : (
              <OCard>
                <div style={{ fontSize: 13, color: brand.textMuted, textAlign: 'center', padding: 20 }}>
                  Cohort retention data will appear once members have been active for multiple months.
                </div>
              </OCard>
            )}

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Retention by Program" />
              <OCard>
                {[
                  { name: 'EFT Monthly', retention: retentionRate, color: retentionRate >= 85 ? brand.success : brand.warning },
                  { name: 'OTC Packages', retention: 80, color: brand.warning },
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
              action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/churn-analysis')}>Full Analysis →</OButton>}
            />
            {churnReasons.filter(r => r.count > 0).length === 0 ? (
              <OCard>
                <div style={{ fontSize: 12, color: brand.textMuted, textAlign: 'center', padding: 16 }}>
                  No churn data yet — all current members are active.
                </div>
              </OCard>
            ) : (
              <OCard>
                {churnReasons.map((r, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{r.reason}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>{r.count} <span style={{ color: brand.textMuted, fontSize: 10 }}>({r.pct}%)</span></div>
                    </div>
                    <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${r.pct * 3}%`, height: '100%', background: brand.danger }} />
                    </div>
                  </div>
                ))}
              </OCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
