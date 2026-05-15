'use client';

import { useState, useEffect } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { Download, FileText, CreditCard, DollarSign, ArrowUpRight } from 'lucide-react';
import type { RevenueReportsData } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = { data: RevenueReportsData };

// ── Demo data (shown when live DB has no revenue records yet) ──────────────

const DEMO_EFT = { total: 57500, count: 190, pct: 71.5, mom: 6.2 };
const DEMO_OTC = { total: 22900, count: 87, pct: 28.5, mom: 14.3 };

const DEMO_SIX_MONTH = [
  { month: 'May', eft: 52000, otc: 22000, total: 74000 },
  { month: 'Jun', eft: 51000, otc: 22000, total: 73000 },
  { month: 'Jul', eft: 52500, otc: 21500, total: 74000 },
  { month: 'Aug', eft: 54000, otc: 22000, total: 76000 },
  { month: 'Sep', eft: 52000, otc: 22000, total: 74000 },
  { month: 'Oct', eft: 57500, otc: 22900, total: 80400 },
];

const DEMO_PROGRAMS = [
  { name: 'Private Hitting Lessons', revenue: 48200 },
  { name: 'Cage Rental',             revenue: 12400 },
  { name: 'Group Classes',           revenue: 9800  },
  { name: 'Team Training',           revenue: 5400  },
  { name: 'Assessments',             revenue: 2800  },
  { name: 'Merch & Retail',          revenue: 1800  },
];
const DEMO_TOTAL_REVENUE = DEMO_PROGRAMS.reduce((s, p) => s + p.revenue, 0); // 80400

const DEMO_LTV = [
  { name: 'Team Training',       ltv: 5480 },
  { name: 'Unlimited Monthly',   ltv: 3368 },
  { name: 'Cage Rental Monthly', ltv: 1440 },
  { name: '8-Pack Lessons',      ltv: 968  },
  { name: '4-Pack Lessons',      ltv: 548  },
  { name: 'Camps & Clinics',     ltv: 390  },
];

const DEMO_TWELVE_MONTH = [
  { month: 'Nov', value: 62 },
  { month: 'Dec', value: 64 },
  { month: 'Jan', value: 66 },
  { month: 'Feb', value: 71 },
  { month: 'Mar', value: 69 },
  { month: 'Apr', value: 72 },
  { month: 'May', value: 74 },
  { month: 'Jun', value: 71 },
  { month: 'Jul', value: 73 },
  { month: 'Aug', value: 76 },
  { month: 'Sep', value: 74 },
  { month: 'Oct', value: 80 },
];

const DEMO_PKG_TABLE = [
  { name: 'Team Training',       price: 450, active: 12,  mrr: 5400,  pct: 6.7,  ltv: 5480 },
  { name: 'Unlimited Monthly',   price: 280, active: 147, mrr: 41160, pct: 51.2, ltv: 3368 },
  { name: 'Cage Rental Monthly', price: 120, active: 31,  mrr: 3720,  pct: 4.6,  ltv: 1440 },
  { name: '8-Pack Lessons',      price: 320, active: 42,  mrr: 13440, pct: 16.7, ltv: 968  },
  { name: '4-Pack Lessons',      price: 180, active: 38,  mrr: 6840,  pct: 8.5,  ltv: 548  },
];

const PROGRAM_COLORS = [
  brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted,
];

function fmtK(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

// ── Inline donut (SVG) ─────────────────────────────────────────────────────

function ProgramDonut({ programs, total }: { programs: typeof DEMO_PROGRAMS; total: number }) {
  const size = 160;
  const radius = 62;
  const circ = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={80} cy={80} r={radius} fill="none" stroke={brand.border} strokeWidth={12} />
      {programs.map((p, i) => {
        const pct = p.revenue / total;
        const dash = `${pct * circ} ${circ}`;
        const offset = -cumulative * circ;
        cumulative += pct;
        return (
          <circle key={i} cx={80} cy={80} r={radius} fill="none"
            stroke={PROGRAM_COLORS[i % PROGRAM_COLORS.length]} strokeWidth={12}
            strokeDasharray={dash} strokeDashoffset={offset}
            transform="rotate(-90 80 80)" />
        );
      })}
      <text x={80} y={74} textAnchor="middle" fontSize={18} fontWeight={700}
        fontFamily={fonts.display} fill={brand.text}>
        {fmtK(total)}
      </text>
      <text x={80} y={90} textAnchor="middle" fontSize={9} fontWeight={700}
        fontFamily={fonts.display} fill={brand.textMuted} letterSpacing={1}>
        OCTOBER
      </text>
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function RevenueReportsContent({ data }: Props) {
  const { eftVsOtc, monthly, cohortRetention } = data;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  // Use live data when available, fall back to demo
  const hasLiveData = eftVsOtc.eftTotal + eftVsOtc.otcTotal > 0;
  const totalRevenue = hasLiveData ? eftVsOtc.eftTotal + eftVsOtc.otcTotal : DEMO_EFT.total + DEMO_OTC.total;
  const eftTotal    = hasLiveData ? eftVsOtc.eftTotal  : DEMO_EFT.total;
  const otcTotal    = hasLiveData ? eftVsOtc.otcTotal  : DEMO_OTC.total;
  const eftCount    = hasLiveData ? eftVsOtc.eftCount  : DEMO_EFT.count;
  const otcCount    = hasLiveData ? eftVsOtc.otcCount  : DEMO_OTC.count;
  const eftPct      = hasLiveData ? Math.round((eftTotal / totalRevenue) * 100) : DEMO_EFT.pct;
  const otcPct      = hasLiveData ? 100 - eftPct : DEMO_OTC.pct;

  const sixMonth  = monthly.length >= 2 ? monthly.slice(-6) : DEMO_SIX_MONTH;
  const sixMax    = Math.max(...sixMonth.map(m => ('total' in m ? (m as typeof DEMO_SIX_MONTH[0]).total : (m as typeof DEMO_SIX_MONTH[0]).total) || 0), 1);

  const twelveMonth = monthly.length >= 6
    ? monthly.slice(-12).map(m => ({ month: m.month, value: Math.round(m.total / 1000) }))
    : DEMO_TWELVE_MONTH;
  const twelveMax = Math.max(...twelveMonth.map(d => d.value), 1);

  return (
    <>
    <div>
      <PageHeader
        title="Revenue Reports"
        subtitle="Deep dive into revenue by program, package, and time period"
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={() => {
              const rows = (hasLiveData ? monthly : DEMO_SIX_MONTH) as Record<string, unknown>[];
              exportCsv(`revenue-report-${new Date().toISOString().slice(0, 10)}.csv`, rows,
                [{ label: 'Month', key: 'month' }, { label: 'EFT ($)', key: 'eft' }, { label: 'OTC ($)', key: 'otc' }, { label: 'Total ($)', key: 'total' }]);
              setToast('Revenue report exported as CSV');
            }}>Export</OButton>
            <OButton variant="gold" icon={FileText} onClick={() => setToast('Monthly report scheduled — you\'ll receive it by email on the 1st')}>Schedule</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>

        {/* ── Row 1: EFT card | OTC card | 6-Month Trend ── */}
        <SectionHeader
          title="EFT vs OTC"
          subtitle="Recurring membership revenue vs upfront cash (new business, camps, drop-ins)"
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: 16, marginBottom: 24 }}>

          {/* EFT */}
          <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>EFT · RECURRING</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Auto-pay membership revenue</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${brand.success}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={17} color={brand.success} />
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>
              ${(eftTotal / 1000).toFixed(1)}K
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: brand.success }}>
                <ArrowUpRight size={13} />{DEMO_EFT.mom}% MoM
              </span>
              <span style={{ fontSize: 12, color: brand.textMuted }}>{eftPct}% of total</span>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
              The healthy foundation — predictable recurring revenue. {eftCount} active EFT members.
            </div>
          </OCard>

          {/* OTC */}
          <OCard style={{ background: `linear-gradient(135deg, ${brand.warningBg} 0%, ${brand.white} 100%)`, borderColor: brand.warning }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.warning, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>OTC · UPFRONT CASH</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>New signups, packages, camps, drop-ins</div>
              </div>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: `${brand.warning}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={17} color={brand.warning} />
              </div>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>
              ${(otcTotal / 1000).toFixed(1)}K
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: brand.success }}>
                <ArrowUpRight size={13} />{DEMO_OTC.mom}% MoM
              </span>
              <span style={{ fontSize: 12, color: brand.textMuted }}>{otcPct}% of total</span>
            </div>
            <div style={{ marginTop: 12, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
              New business, packages, camps, and drop-ins. {otcCount} OTC transactions this month.
            </div>
          </OCard>

          {/* 6-Month Trend */}
          <OCard>
            <div style={{ fontSize: 11, fontWeight: 800, fontFamily: fonts.display, letterSpacing: 1, color: brand.text, marginBottom: 16, textTransform: 'uppercase' }}>
              6-Month Trend
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, paddingBottom: 22, position: 'relative' }}>
              {sixMonth.map((m, i) => {
                const mo = m as typeof DEMO_SIX_MONTH[0];
                const heightPct = (mo.total / sixMax) * 100;
                const eftH = (mo.eft / Math.max(mo.total, 1)) * 100;
                const isLast = i === sixMonth.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 }}>
                    <div style={{ fontSize: 8, color: brand.textMuted, fontWeight: 700 }}>{fmtK(mo.total)}</div>
                    <div style={{ width: '100%', height: `${heightPct}%`, borderRadius: '3px 3px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 4, opacity: isLast ? 1 : 0.82 }}>
                      <div style={{ height: `${eftH}%`, background: brand.success, minHeight: 2 }} />
                      <div style={{ flex: 1, background: brand.warning, minHeight: 2 }} />
                    </div>
                    <div style={{ fontSize: 8, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0 }}>{mo.month}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: brand.success }} />
                <span style={{ fontWeight: 600 }}>EFT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: brand.warning }} />
                <span style={{ fontWeight: 600 }}>OTC</span>
              </div>
            </div>
          </OCard>
        </div>

        {/* ── Row 2: Revenue by Program | Package Performance LTV ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Revenue by Program */}
          <OCard>
            <SectionHeader title="Revenue by Program" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ProgramDonut programs={DEMO_PROGRAMS} total={DEMO_TOTAL_REVENUE} />
              <div style={{ flex: 1 }}>
                {DEMO_PROGRAMS.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: PROGRAM_COLORS[i % PROGRAM_COLORS.length], flexShrink: 0 }} />
                    <div style={{ flex: 1, color: brand.text }}>{p.name}</div>
                    <div style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.text }}>{fmtK(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          </OCard>

          {/* Package Performance — LTV */}
          <OCard>
            <SectionHeader title="Package Performance — LTV" />
            {DEMO_LTV.map((p, i) => {
              const maxLtv = DEMO_LTV[0].ltv;
              const barW = Math.round((p.ltv / maxLtv) * 100);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < DEMO_LTV.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: brand.text }}>{p.name}</div>
                  <div style={{ width: 100, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${barW}%`, height: '100%', background: brand.goldDeep, borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, width: 56, textAlign: 'right', color: brand.goldDeep }}>
                    ${p.ltv.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </OCard>
        </div>

        {/* ── Row 3: 12-Month Revenue Trend ── */}
        <SectionHeader title="12-Month Revenue Trend" />
        <OCard style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200, paddingBottom: 22, position: 'relative' }}>
            {twelveMonth.map((d, i) => {
              const isLast = i === twelveMonth.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 }}>
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>{d.value}</div>
                  <div style={{
                    width: '100%',
                    height: `${(d.value / twelveMax) * 100}%`,
                    background: isLast ? brand.gold : brand.goldDeep,
                    borderRadius: '4px 4px 0 0',
                    minHeight: 4,
                    opacity: isLast ? 1 : 0.85,
                  }} />
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0 }}>{d.month}</div>
                </div>
              );
            })}
          </div>
        </OCard>

        {/* ── Row 4: Revenue by Package — Monthly Detail ── */}
        <SectionHeader title="Revenue by Package — Monthly Detail" />
        <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                {['Package', 'Price', 'Active', 'MRR', '% of Revenue', 'LTV'].map((h, i) => (
                  <th key={i} style={{
                    padding: '12px 16px',
                    textAlign: i === 0 ? 'left' : 'right',
                    fontSize: 10, fontWeight: 800, color: brand.textMuted,
                    letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_PKG_TABLE.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < DEMO_PKG_TABLE.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: brand.text }}>{row.name}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 600, color: brand.text, textAlign: 'right' }}>${row.price}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 600, color: brand.text, textAlign: 'right' }}>{row.active}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.text, textAlign: 'right' }}>{fmtK(row.mrr)}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: brand.text, textAlign: 'right' }}>{row.pct}%</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep, textAlign: 'right' }}>${row.ltv.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Cohort Retention (kept as-is, only shown when DB has data) ── */}
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
    {/* Toast */}
    {toast && (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
        {toast}
      </div>
    )}
    </>
  );
}
