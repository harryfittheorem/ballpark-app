'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { Download, FileText, CreditCard, DollarSign } from 'lucide-react';
import type { RevenueReportsData, RevenueTransaction } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = {
  data: RevenueReportsData;
  transactions: RevenueTransaction[];
  startDate: string;
  endDate: string;
  defaultStart: string;
  defaultEnd: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────

const PROGRAM_COLORS = [
  brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted,
];

function fmtK(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n}`;
}

function ProgramDonut({ programs, total }: { programs: Array<{ name: string; count: number }>; total: number }) {
  const size = 160;
  const radius = 62;
  const circ = 2 * Math.PI * radius;
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={80} cy={80} r={radius} fill="none" stroke={brand.border} strokeWidth={12} />
      {programs.map((p, i) => {
        const pct = p.count / total;
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
        {total}
      </text>
      <text x={80} y={90} textAnchor="middle" fontSize={9} fontWeight={700}
        fontFamily={fonts.display} fill={brand.textMuted} letterSpacing={1}>
        SESSIONS
      </text>
    </svg>
  );
}

const STATUS_COLOR: Record<string, string> = {
  paid:     brand.success,
  failed:   brand.danger,
  refunded: brand.warning,
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${brand.border}`,
  background: brand.surface,
  fontSize: 13,
  color: brand.text,
  fontFamily: fonts.mono,
};

// ── Component ──────────────────────────────────────────────────────────────

export function RevenueReportsContent({ data, transactions, startDate, endDate, defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { eftVsOtc, monthly, packages, programBreakdown, cohortRetention } = data;
  const [toast, setToast]       = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [start, setStart] = useState(startDate);
  const [end, setEnd]     = useState(endDate);

  function applyFilter() {
    startTransition(() => {
      router.push(`/owner/revenue-reports?start=${start}&end=${end}`);
    });
  }

  function showToast(msg: string, isError = false) {
    setToast(msg);
    setToastError(isError);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSendReport() {
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await fetch('/api/owner/send-revenue-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eftTotal:         eftVsOtc.eftTotal,
          otcTotal:         eftVsOtc.otcTotal,
          transactionCount: transactions.length,
          startDate:        startDate,
          endDate:          endDate,
        }),
      });
      const json = await res.json() as { success?: boolean; skipped?: boolean; sentTo?: string; error?: string };
      if (json.skipped) {
        showToast('Email not configured — set RESEND_API_KEY to enable delivery', true);
      } else if (!res.ok || json.error) {
        showToast(json.error ?? 'Failed to send report', true);
      } else {
        showToast(`Report sent to ${json.sentTo ?? 'your email'} ✓`);
      }
    } catch {
      showToast('Network error — could not send report', true);
    } finally {
      setIsSending(false);
    }
  }

  // Detect whether the DB has revenue records to show
  const hasLiveData = eftVsOtc.eftTotal + eftVsOtc.otcTotal > 0;

  const totalRevenue = eftVsOtc.eftTotal + eftVsOtc.otcTotal;
  const eftTotal     = eftVsOtc.eftTotal;
  const otcTotal     = eftVsOtc.otcTotal;
  const eftCount     = eftVsOtc.eftCount;
  const otcCount     = eftVsOtc.otcCount;
  const eftPct       = totalRevenue > 0 ? Math.round((eftTotal / totalRevenue) * 100) : 0;
  const otcPct       = 100 - eftPct;

  const sixMonth  = monthly.slice(-6);
  const sixMax    = Math.max(...sixMonth.map(m => m.total), 1);

  const twelveMonth = monthly.slice(-12).map(m => ({ month: m.month, value: Math.round(m.total / 1000) }));
  const twelveMax   = Math.max(...twelveMonth.map(d => d.value), 1);

  const ltvPackages = [...packages].sort((a, b) => b.ltv - a.ltv);
  const maxLtv      = ltvPackages[0]?.ltv ?? 1;

  const totalSessions = programBreakdown.reduce((s, p) => s + p.count, 0);

  function handleExportTransactions() {
    if (transactions.length === 0) return;
    exportCsv(
      `revenue-transactions-${start}-to-${end}.csv`,
      transactions.map(t => ({
        date:           t.date,
        member_name:    t.memberName,
        plan_name:      t.planName,
        plan_type:      t.planType,
        amount:         t.amountDollars.toFixed(2),
        payment_method: t.paymentMethod,
        status:         t.status,
      })),
      [
        { label: 'Date',           key: 'date'           },
        { label: 'Member Name',    key: 'member_name'    },
        { label: 'Plan Name',      key: 'plan_name'      },
        { label: 'Plan Type',      key: 'plan_type'      },
        { label: 'Amount ($)',     key: 'amount'         },
        { label: 'Payment Method', key: 'payment_method' },
        { label: 'Status',         key: 'status'         },
      ],
    );
    showToast(`Exported ${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} as CSV`);
  }

  const isDefaultRange = startDate === defaultStart && endDate === defaultEnd;
  const rangeLabel = isDefaultRange ? 'Last 12 Months' : `${startDate} – ${endDate}`;

  return (
    <>
    <div>
      <PageHeader
        title="Revenue Reports"
        subtitle="Deep dive into revenue by program, package, and time period"
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={handleExportTransactions} disabled={transactions.length === 0}>Export CSV</OButton>
            <OButton variant="gold" icon={FileText} onClick={handleSendReport} disabled={isSending}>
              {isSending ? 'Sending…' : 'Email Report'}
            </OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>

        {/* ── Revenue KPI sections (only shown when live data exists) ── */}
        {!hasLiveData ? (
          <OCard style={{ marginBottom: 24, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: brand.text, marginBottom: 8, fontFamily: fonts.display }}>No revenue data yet</div>
            <div style={{ fontSize: 13, color: brand.textMuted, maxWidth: 400, margin: '0 auto' }}>
              Revenue charts and KPIs will appear once payment events have been recorded. Run the portal demo seed to populate sample data.
            </div>
          </OCard>
        ) : (
          <>
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
              {sixMonth.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: brand.textMuted, fontSize: 12 }}>No data yet</div>
            ) : sixMonth.map((m, i) => {
                const heightPct = (m.total / sixMax) * 100;
                const eftH = (m.eft / Math.max(m.total, 1)) * 100;
                const isLast = i === sixMonth.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 }}>
                    <div style={{ fontSize: 8, color: brand.textMuted, fontWeight: 700 }}>{fmtK(m.total)}</div>
                    <div style={{ width: '100%', height: `${heightPct}%`, borderRadius: '3px 3px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 4, opacity: isLast ? 1 : 0.82 }}>
                      <div style={{ height: `${eftH}%`, background: brand.success, minHeight: 2 }} />
                      <div style={{ flex: 1, background: brand.warning, minHeight: 2 }} />
                    </div>
                    <div style={{ fontSize: 8, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0 }}>{m.month}</div>
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

          {/* Sessions by Program */}
          <OCard>
            <SectionHeader title="Sessions by Program" subtitle="Bookings in the last 12 months" />
            {totalSessions === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: brand.textMuted, fontSize: 12 }}>No booking data yet</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <ProgramDonut programs={programBreakdown} total={totalSessions} />
                <div style={{ flex: 1 }}>
                  {programBreakdown.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: PROGRAM_COLORS[i % PROGRAM_COLORS.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, color: brand.text }}>{p.name}</div>
                      <div style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.text }}>{p.count} sessions</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </OCard>

          {/* Package Performance — LTV */}
          <OCard>
            <SectionHeader title="Package Performance — LTV" />
            {ltvPackages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: brand.textMuted, fontSize: 12 }}>No package data yet</div>
            ) : ltvPackages.map((p, i) => {
              const barW = Math.round((p.ltv / maxLtv) * 100);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < ltvPackages.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
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
        <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
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
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>No package data yet</td>
                </tr>
              ) : packages.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < packages.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: brand.text }}>{row.name}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 600, color: brand.text, textAlign: 'right' }}>${row.price.toFixed(0)}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 600, color: brand.text, textAlign: 'right' }}>{row.activeCount}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.text, textAlign: 'right' }}>{fmtK(row.mrr)}</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: brand.text, textAlign: 'right' }}>{row.pctRevenue}%</td>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep, textAlign: 'right' }}>${row.ltv.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </>
        )}

        {/* ── Row 5: Transaction List (real data) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <SectionHeader title={`Transactions — ${rangeLabel}`} />
        </div>

        {/* Date range filter */}
        <OCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: brand.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Date Range
            </div>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 12, color: brand.textMuted }}>to</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
            <OButton variant="gold" size="sm" onClick={applyFilter}>Apply</OButton>
            <span style={{ fontSize: 11, color: brand.textMuted, marginLeft: 'auto' }}>
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </OCard>

        {transactions.length === 0 ? (
          <OCard>
            <div style={{ textAlign: 'center', padding: '32px 0', color: brand.textMuted }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No transactions in this period</div>
              <div style={{ fontSize: 12 }}>Try expanding the date range.</div>
            </div>
          </OCard>
        ) : (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                  {[
                    { label: 'Date',           align: 'left'  },
                    { label: 'Member Name',    align: 'left'  },
                    { label: 'Plan Name',      align: 'left'  },
                    { label: 'Plan Type',      align: 'left'  },
                    { label: 'Amount ($)',     align: 'right' },
                    { label: 'Payment Method', align: 'left'  },
                    { label: 'Status',         align: 'left'  },
                  ].map((h, i) => (
                    <th key={i} style={{
                      padding: '12px 16px',
                      textAlign: h.align as 'left' | 'right',
                      fontSize: 10, fontWeight: 800, color: brand.textMuted,
                      letterSpacing: 1, textTransform: 'uppercase',
                      fontFamily: fonts.display, whiteSpace: 'nowrap',
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < transactions.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: fonts.mono, color: brand.textMuted, whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontWeight: 700, color: brand.text }}>{t.memberName}</td>
                    <td style={{ padding: '13px 16px', fontSize: 12, color: brand.text }}>{t.planName}</td>
                    <td style={{ padding: '13px 16px', fontSize: 11, fontFamily: fonts.mono, color: brand.textMuted }}>{t.planType}</td>
                    <td style={{ padding: '13px 16px', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.text, textAlign: 'right' }}>
                      {t.amountDollars.toFixed(2)}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: fonts.mono, color: brand.textMuted }}>{t.paymentMethod}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: `${STATUS_COLOR[t.status] ?? brand.border}22`,
                        color: STATUS_COLOR[t.status] ?? brand.textMuted,
                      }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Cohort Retention ── */}
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

    {toast && (
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: toastError ? brand.danger : brand.dark, color: toastError ? '#fff' : brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
        {toast}
      </div>
    )}
    </>
  );
}
