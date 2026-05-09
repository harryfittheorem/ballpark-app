'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { OButton, PageHeader, SectionHeader, OCard, OTable, BarChart, DonutChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, FileText, CreditCard, DollarSign } from 'lucide-react';

type RevenueRow = typeof demoData.revenueByPackage[0];

const pkgColumns: TableColumn<RevenueRow & Record<string, unknown>>[] = [
  { label: 'Package', key: 'name', render: (r) => <span style={{ fontWeight: 700 }}>{r.name}</span> },
  { label: 'Price', key: 'price', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>${r.price}</span> },
  { label: 'Active', key: 'activeCount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.activeCount}</span> },
  { label: 'MRR', key: 'mrr', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.mrr / 1000).toFixed(1)}K</span> },
  { label: '% of Revenue', key: 'pctRevenue', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.pctRevenue}%</span> },
  { label: 'LTV', key: 'ltv', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>${r.ltv.toLocaleString()}</span> },
];

const cohortData = [
  { cohort: 'May 2025', size: 38, retention: [100, 92, 87, 84, 81, 79, 76] },
  { cohort: 'Jun 2025', size: 42, retention: [100, 90, 86, 83, 80, 77, null] },
  { cohort: 'Jul 2025', size: 35, retention: [100, 91, 85, 82, 78, null, null] },
  { cohort: 'Aug 2025', size: 51, retention: [100, 93, 89, 85, null, null, null] },
  { cohort: 'Sep 2025', size: 44, retention: [100, 91, 87, null, null, null, null] },
  { cohort: 'Oct 2025', size: 47, retention: [100, 94, null, null, null, null, null] },
];

export default function RevenueReportsPage() {
  return (
    <div>
      <PageHeader
        title="Revenue Reports"
        subtitle="Deep dive into revenue by program, package, and time period"
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={FileText}>Schedule</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <SectionHeader title="EFT vs OTC" subtitle="Recurring membership revenue vs upfront cash (new business, camps, drop-ins)" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>EFT · RECURRING</div>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.eftVsOtc.eft.description}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.success}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} color={brand.success} />
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${(demoData.eftVsOtc.eft.amount / 1000).toFixed(1)}K</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: brand.success, fontWeight: 700 }}>↑ {demoData.eftVsOtc.eft.mom}% MoM</div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>·</div>
                <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{demoData.eftVsOtc.eft.pct}% of total</div>
              </div>
              <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
                The healthy foundation — predictable recurring revenue. 190 active EFT members.
              </div>
            </OCard>

            <OCard style={{ background: `linear-gradient(135deg, ${brand.warningBg} 0%, ${brand.white} 100%)`, borderColor: brand.warning }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: brand.warning, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>OTC · UPFRONT CASH</div>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.eftVsOtc.otc.description}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.warning}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={18} color={brand.warning} />
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${(demoData.eftVsOtc.otc.amount / 1000).toFixed(1)}K</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: brand.success, fontWeight: 700 }}>↑ {demoData.eftVsOtc.otc.mom}% MoM</div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>·</div>
                <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{demoData.eftVsOtc.otc.pct}% of total</div>
              </div>
              <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
                New business, packages, camps, and drop-ins. 87 OTC transactions this month.
              </div>
            </OCard>
          </div>

          <OCard>
            <SectionHeader title="6-Month Trend" />
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 20, position: 'relative' }}>
              {demoData.eftVsOtcMonthly.map((m, i) => {
                const total = m.eft + m.otc;
                const max = 82000;
                const heightTotal = (total / max) * 100;
                const eftHeight = (m.eft / max) * 100;
                const isLast = i === demoData.eftVsOtcMonthly.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>${Math.round(total / 1000)}K</div>
                    <div style={{ width: '100%', height: `${heightTotal}%`, position: 'relative', borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 2, opacity: isLast ? 1 : 0.85 }}>
                      <div style={{ height: `${(eftHeight / heightTotal) * 100}%`, background: brand.success, minHeight: 2 }} />
                      <div style={{ flex: 1, background: brand.warning, minHeight: 2 }} />
                    </div>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0, transform: 'translateY(14px)' }}>{m.month}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 24, fontSize: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: brand.success }} />
                <span style={{ fontWeight: 600 }}>EFT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: brand.warning }} />
                <span style={{ fontWeight: 600 }}>OTC</span>
              </div>
            </div>
          </OCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <OCard>
            <SectionHeader title="Revenue by Program" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative' }}>
                <DonutChart data={demoData.revenueByProgram.map((p, i) => ({
                  value: p.revenue,
                  color: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i],
                }))} size={160} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display }}>$80.4K</div>
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>OCTOBER</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {demoData.revenueByProgram.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i] }} />
                    <div style={{ flex: 1 }}>{p.name}</div>
                    <div style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(p.revenue / 1000).toFixed(1)}K</div>
                  </div>
                ))}
              </div>
            </div>
          </OCard>

          <OCard>
            <SectionHeader title="Package Performance — LTV" />
            {[...demoData.revenueByPackage].sort((a, b) => b.ltv - a.ltv).map((p, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < demoData.revenueByPackage.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${(p.ltv / 5400) * 100}%`, height: '100%', background: brand.goldDeep }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, width: 62, textAlign: 'right' }}>${p.ltv.toLocaleString()}</div>
              </div>
            ))}
          </OCard>
        </div>

        <SectionHeader title="12-Month Revenue Trend" />
        <OCard>
          <BarChart data={[
            { label: 'Nov', value: 62 }, { label: 'Dec', value: 64 }, { label: 'Jan', value: 68 },
            { label: 'Feb', value: 71 }, { label: 'Mar', value: 69 }, { label: 'Apr', value: 72 },
            { label: 'May', value: 74 }, { label: 'Jun', value: 71 }, { label: 'Jul', value: 73 },
            { label: 'Aug', value: 76 }, { label: 'Sep', value: 74 }, { label: 'Oct', value: 80, highlight: true },
          ]} height={220} />
        </OCard>

        <div style={{ marginTop: 20 }}>
          <SectionHeader title="Revenue by Package — Monthly Detail" />
          <OTable
            columns={pkgColumns as TableColumn<Record<string, unknown>>[]}
            rows={demoData.revenueByPackage as unknown as Record<string, unknown>[]}
          />
        </div>

        <div style={{ marginTop: 24 }}>
          <SectionHeader title="Cohort Retention Grid" subtitle="% of members still active N months after join. Hover cells for raw counts." />
          <OCard padding={0}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                    <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Cohort</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>Size</th>
                    {['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'].map(m => (
                      <th key={m} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < cohortData.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 12 }}>{row.cohort}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: fonts.mono, color: brand.textMuted, fontSize: 11 }}>{row.size}</td>
                      {row.retention.map((pct, j) => {
                        const bg = pct === null ? brand.surfaceAlt
                          : pct >= 90 ? '#22c55e33'
                          : pct >= 80 ? '#84cc1633'
                          : pct >= 70 ? '#eab30833'
                          : pct >= 60 ? '#f9731633'
                          : '#ef444433';
                        const textColor = pct === null ? brand.textMuted
                          : pct >= 80 ? brand.success
                          : pct >= 60 ? brand.warning
                          : brand.danger;
                        return (
                          <td key={j} title={pct !== null ? `${Math.round(row.size * pct / 100)} members` : 'n/a'} style={{ padding: '10px 12px', textAlign: 'center', background: bg, fontFamily: fonts.mono, fontWeight: 700, color: textColor, fontSize: 12 }}>
                            {pct !== null ? `${pct}%` : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', borderTop: `1px solid ${brand.border}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { color: '#22c55e33', text: brand.success, label: '≥ 90%' },
                { color: '#84cc1633', text: '#65a30d', label: '80–89%' },
                { color: '#eab30833', text: brand.warning, label: '70–79%' },
                { color: '#f9731633', text: '#ea580c', label: '60–69%' },
                { color: '#ef444433', text: brand.danger, label: '< 60%' },
              ].map((leg, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: leg.color, border: `1px solid ${leg.text}55` }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: leg.text }}>{leg.label}</span>
                </div>
              ))}
            </div>
          </OCard>
        </div>
      </div>
    </div>
  );
}
