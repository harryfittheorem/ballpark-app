'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, OTable, BarChart, DonutChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, FileText, CreditCard, DollarSign } from 'lucide-react';
import type { RevenueReportsData, MembershipPackage } from '@/lib/supabase/ownerQueries';

type Props = { data: RevenueReportsData };

const pkgColumns: TableColumn<MembershipPackage & Record<string, unknown>>[] = [
  { label: 'Package', key: 'name', render: (r) => <span style={{ fontWeight: 700 }}>{r.name as string}</span> },
  { label: 'Type', key: 'planType', render: (r) => <span style={{ textTransform: 'uppercase', fontSize: 11 }}>{r.planType as string}</span> },
  { label: 'Price', key: 'price', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>${r.price as number}</span> },
  { label: 'Active', key: 'activeCount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.activeCount as number}</span> },
  { label: 'MRR', key: 'mrr', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.mrr as number).toLocaleString()}</span> },
  { label: '% of Revenue', key: 'pctRevenue', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.pctRevenue as number}%</span> },
  { label: 'LTV', key: 'ltv', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>${(r.ltv as number).toLocaleString()}</span> },
];

export function RevenueReportsContent({ data }: Props) {
  const { eftVsOtc, monthly, packages, cohortRetention } = data;
  const packageColors = [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted];

  const chartMax = Math.max(...monthly.map(m => m.total), 1);
  const chartData = monthly.map(m => ({
    label: m.month,
    value: Math.round((m.total / chartMax) * 100),
    highlight: false,
  }));
  if (chartData.length > 0) chartData[chartData.length - 1].highlight = true;

  const totalRevenue = eftVsOtc.eftTotal + eftVsOtc.otcTotal;
  const eftPct = totalRevenue > 0 ? Math.round((eftVsOtc.eftTotal / totalRevenue) * 100) : 0;
  const otcPct = 100 - eftPct;

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
        <SectionHeader title="EFT vs OTC" subtitle="Recurring membership revenue vs upfront cash" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>EFT · RECURRING</div>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{eftVsOtc.eftCount} active EFT members</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.success}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} color={brand.success} />
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${eftVsOtc.eftTotal.toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{eftPct}% of total</div>
              </div>
              <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
                Predictable recurring revenue from EFT members.
              </div>
            </OCard>

            <OCard style={{ background: `linear-gradient(135deg, ${brand.warningBg} 0%, ${brand.white} 100%)`, borderColor: brand.warning }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: brand.warning, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>OTC · UPFRONT CASH</div>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{eftVsOtc.otcCount} OTC packages</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.warning}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DollarSign size={18} color={brand.warning} />
                </div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${eftVsOtc.otcTotal.toLocaleString()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{otcPct}% of total</div>
              </div>
              <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
                New business, packages, and upfront cash transactions.
              </div>
            </OCard>
          </div>

          {monthly.length > 0 && (
            <OCard>
              <SectionHeader title="Monthly Trend" />
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 20, position: 'relative' }}>
                {monthly.map((m, i) => {
                  const total = m.total;
                  const max = Math.max(...monthly.map(x => x.total), 1);
                  const heightTotal = (total / max) * 100;
                  const eftHeight = (m.eft / Math.max(total, 1)) * 100;
                  const isLast = i === monthly.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
                      <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>${Math.round(total)}</div>
                      <div style={{ width: '100%', height: `${heightTotal}%`, position: 'relative', borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 2, opacity: isLast ? 1 : 0.85 }}>
                        <div style={{ height: `${eftHeight}%`, background: brand.success, minHeight: 2 }} />
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
          )}
        </div>

        {packages.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <OCard>
              <SectionHeader title="Revenue by Package" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative' }}>
                  <DonutChart
                    data={packages.map((p, i) => ({ value: Math.max(p.mrr, 1), color: packageColors[i % packageColors.length] }))}
                    size={160}
                  />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>${(eftVsOtc.eftTotal + eftVsOtc.otcTotal).toLocaleString()}</div>
                    <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>TOTAL</div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  {packages.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: packageColors[i % packageColors.length] }} />
                      <div style={{ flex: 1 }}>{p.name}</div>
                      <div style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${p.mrr.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </OCard>

            <OCard>
              <SectionHeader title="Package Performance — LTV" />
              {[...packages].sort((a, b) => b.ltv - a.ltv).map((p, i) => (
                <div key={i} style={{ padding: '8px 0', borderBottom: i < packages.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (p.ltv / Math.max(...packages.map(x => x.ltv))) * 100)}%`, height: '100%', background: brand.goldDeep }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, width: 62, textAlign: 'right' }}>${p.ltv.toLocaleString()}</div>
                </div>
              ))}
            </OCard>
          </div>
        )}

        {chartData.length > 0 && (
          <>
            <SectionHeader title="Revenue Trend" />
            <OCard>
              <BarChart data={chartData} height={220} />
            </OCard>
          </>
        )}

        {packages.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Revenue by Package — Detail" />
            <OTable
              columns={pkgColumns as TableColumn<Record<string, unknown>>[]}
              rows={packages as unknown as Record<string, unknown>[]}
            />
          </div>
        )}

        {cohortRetention.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <SectionHeader title="Cohort Retention" subtitle="% of members still active since joining" />
            <OCard padding={0}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>Cohort</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>Size</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>M0</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, fontSize: 10, color: brand.textMuted, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohortRetention.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < cohortRetention.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 700, fontSize: 12 }}>{row.cohort}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: fonts.mono, color: brand.textMuted }}>{row.size}</td>
                        {row.retention.map((pct, j) => {
                          const bg = pct >= 90 ? '#22c55e33' : pct >= 80 ? '#84cc1633' : pct >= 70 ? '#eab30833' : '#ef444433';
                          const textColor = pct >= 80 ? brand.success : pct >= 60 ? brand.warning : brand.danger;
                          return (
                            <td key={j} style={{ padding: '10px 12px', textAlign: 'center', background: bg, fontFamily: fonts.mono, fontWeight: 700, color: textColor }}>
                              {pct}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </OCard>
          </div>
        )}
      </div>
    </div>
  );
}
