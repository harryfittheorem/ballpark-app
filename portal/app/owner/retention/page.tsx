'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { TrendingUp, TrendingDown, Clock, DollarSign, Download } from 'lucide-react';

export default function RetentionPage() {
  const router = useRouter();

  return (
    <div>
      <PageHeader
        title="Retention Analytics"
        subtitle="Understand why members stay — and why they leave"
        actions={<OButton variant="secondary" icon={Download}>Export</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Retention Rate" value="89.4%" delta={1.8} icon={TrendingUp} color="success" />
          <KPICard label="Churn Rate (monthly)" value="2.1%" delta={-0.4} icon={TrendingDown} color="success" />
          <KPICard label="Avg Lifetime" value="14.2" unit="mo" delta={8.1} icon={Clock} />
          <KPICard label="Avg LTV" value="$2,340" delta={12.3} icon={DollarSign} color="gold" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Cohort Retention Heatmap" subtitle="Each row: a signup cohort. Columns show % retained over time." />
            <OCard>
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, textAlign: 'left' }}>COHORT</th>
                      <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>SIZE</th>
                      {[0,1,2,3,4,5,6,7,8,9].map(m => (
                        <th key={m} style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>M{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {demoData.cohortRetention.map((c, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${brand.border}` }}>
                        <td style={{ padding: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.cohort}</td>
                        <td style={{ padding: 8, fontFamily: fonts.mono, textAlign: 'center' }}>{c.size}</td>
                        {[0,1,2,3,4,5,6,7,8,9].map(m => {
                          const v = c.retention[m];
                          if (v === undefined) return <td key={m} style={{ padding: 6 }} />;
                          const intensity = (v - 70) / 30;
                          return (
                            <td key={m} style={{ padding: 6 }}>
                              <div style={{ padding: '4px 6px', borderRadius: 4, background: `rgba(91, 138, 58, ${Math.max(0.15, intensity)})`, color: intensity > 0.5 ? brand.white : brand.text, fontWeight: 700, textAlign: 'center', fontFamily: fonts.mono, fontSize: 10 }}>
                                {v.toFixed(0)}%
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
                  { name: 'Unlimited Monthly', retention: 92.1, color: brand.success },
                  { name: 'Team Training', retention: 94.2, color: brand.success },
                  { name: '8-Pack Lessons', retention: 81.4, color: brand.warning },
                  { name: '4-Pack Lessons', retention: 76.8, color: brand.warning },
                  { name: 'Cage Rental', retention: 88.5, color: brand.success },
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
            <OCard>
              {demoData.churnReasons.map((r, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < demoData.churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
