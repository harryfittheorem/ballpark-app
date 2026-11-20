'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { PlayerLink } from '@/components/owner/PlayerLink';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  KPICard, OButton, PageHeader, SectionHeader, OCard, BarChart, DonutChart, Chip,
} from '@/components/owner/ui';
import {
  DollarSign, Users, TrendingUp, AlertTriangle, AlertCircle,
  Download, Plus, Calendar, CheckCircle2, XCircle, CreditCard, X, Clock, Battery,
} from 'lucide-react';
import { exportCsv } from '@/lib/exportCsv';
import type { OwnerKPIs, OwnerMember, RevenueMonth, MembershipPackage } from '@/lib/supabase/ownerQueries';

type Props = {
  kpis: OwnerKPIs;
  members: OwnerMember[];
  revenueMonthly: RevenueMonth[];
  packages: MembershipPackage[];
  locationName: string;
  tenantName: string;
  stripeConnected?: boolean;
};

// ── Demo data (shown when no live DB data exists) ──────────────────────────

const DEMO_KPIS: OwnerKPIs = {
  mrr: 80400, activeMembers: 147, totalMembers: 162,
  failedPaymentsCount: 3, atRiskCount: 8,
  collectedMtd: 75800, autoPayRate: 94.7, pastDue: 1240,
  retentionRate: 91.2, sessionsToday: 20, utilizationPct: 78,
  paidToday: 4200, paidTodayCount: 14,
  newSignupsMtd: 7, newSignupsDelta: 3,
  churnedMtd: 2, churnedMrrImpact: 560,
};

const DEMO_MEMBERS: OwnerMember[] = [
  { id: 'd1', kidId: 'k1', name: 'Marcus Williams', age: '10U', parent: 'Darius Williams',  parentEmail: 'darius@example.com',   parentPhone: null, program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 41, churnRisk: 'high',   lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024', riskReason: '28 days without a session plus one failed payment. High churn probability.', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd2', kidId: 'k2', name: 'Tyler Johnson',   age: '14U', parent: 'Brad Johnson',      parentEmail: 'brad@example.com',     parentPhone: null, program: 'Team Training',        planType: 'eft', status: 'active', engagementScore: 60, churnRisk: 'high',   lastSession: '23d ago', nextCharge: 'Jun 5',   mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024', riskReason: '23 days since last session. Coach should call within 48 hours.',            cardLast4: '5555', cardBrand: 'Mastercard', cardExpMonth: 6,    cardExpYear: 2028 },
  { id: 'd3', kidId: 'k3', name: 'Ethan Brooks',    age: '13U', parent: 'Kevin Brooks',      parentEmail: 'kevin@example.com',    parentPhone: null, program: 'Cage Rental Monthly',  planType: 'eft', status: 'active', engagementScore: 63, churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3',   mrr: 120, lifetime: 960,  joinedDate: 'Jul 2024', riskReason: 'Attendance dropped significantly vs prior months.',                           cardLast4: '4444', cardBrand: 'Mastercard', cardExpMonth: 8,    cardExpYear: 2027 },
  { id: 'd4', kidId: 'k4', name: 'Noah Patel',      age: '11U', parent: 'Raj Patel',         parentEmail: 'raj@example.com',      parentPhone: null, program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 55, churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8',   mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024', riskReason: 'Missed last 3 scheduled sessions without notice.',                           cardLast4: '1234', cardBrand: 'Visa',       cardExpMonth: 11,   cardExpYear: 2026 },
  { id: 'd5', kidId: 'k5', name: 'Jake Martinez',   age: '12U', parent: 'Carlos Martinez',   parentEmail: 'carlos@example.com',   parentPhone: null, program: 'Unlimited Monthly',   planType: 'eft', status: 'active', engagementScore: 92, churnRisk: 'low',    lastSession: '2d ago',  nextCharge: 'Jun 1',   mrr: 280, lifetime: 3920, joinedDate: 'Jan 2025',                                                                                                    cardLast4: '4242', cardBrand: 'Visa',       cardExpMonth: 12,   cardExpYear: 2029 },
  { id: 'd6', kidId: 'k6', name: 'Ryan Chen',       age: '11U', parent: 'David Chen',        parentEmail: 'david@example.com',    parentPhone: null, program: '8-Pack Lessons',       planType: 'otc', status: 'active', engagementScore: 85, churnRisk: 'low',    lastSession: '5d ago',  nextCharge: '—',        mrr: 0,   lifetime: 1280, joinedDate: 'Feb 2025',                                                                                                    cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
];

const DEMO_REVENUE: RevenueMonth[] = [
  { month: 'Nov', eft: 52000, otc: 10000, total: 62000 },
  { month: 'Dec', eft: 53000, otc: 11000, total: 64000 },
  { month: 'Jan', eft: 54000, otc: 12000, total: 66000 },
  { month: 'Feb', eft: 57000, otc: 14000, total: 71000 },
  { month: 'Mar', eft: 55000, otc: 14000, total: 69000 },
  { month: 'Apr', eft: 57000, otc: 15000, total: 72000 },
  { month: 'May', eft: 58000, otc: 16000, total: 74000 },
  { month: 'Jun', eft: 55000, otc: 16000, total: 71000 },
  { month: 'Jul', eft: 57000, otc: 16000, total: 73000 },
  { month: 'Aug', eft: 60000, otc: 16000, total: 76000 },
  { month: 'Sep', eft: 58000, otc: 16000, total: 74000 },
  { month: 'Oct', eft: 63000, otc: 17400, total: 80400 },
];

const DEMO_PACKAGES: MembershipPackage[] = [
  { name: 'Unlimited Monthly',   planType: 'eft', price: 280, activeCount: 147, mrr: 41160, pctRevenue: 51, ltv: 3368 },
  { name: 'Team Training',       planType: 'eft', price: 450, activeCount: 12,  mrr: 5400,  pctRevenue: 7,  ltv: 5480 },
  { name: 'Cage Rental Monthly', planType: 'eft', price: 120, activeCount: 31,  mrr: 3720,  pctRevenue: 5,  ltv: 1440 },
  { name: '8-Pack Lessons',      planType: 'otc', price: 320, activeCount: 42,  mrr: 13440, pctRevenue: 17, ltv: 968  },
  { name: '4-Pack Lessons',      planType: 'otc', price: 180, activeCount: 38,  mrr: 6840,  pctRevenue: 9,  ltv: 548  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function DashboardContent({ kpis: rawKpis, members: rawMembers, revenueMonthly: rawRevenue, packages: rawPackages, tenantName, stripeConnected }: Props) {
  const router = useRouter();
  const [stripeBannerDismissed, setStripeBannerDismissed] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const hasLiveData    = rawKpis.mrr > 0 || rawKpis.activeMembers > 0;
  const kpis = rawKpis;
  const members = rawMembers;
  const revenueMonthly = rawRevenue;
  const packages = rawPackages;

  const atRisk    = members.filter(m => m.status === 'active' && (m.churnRisk === 'high' || m.churnRisk === 'medium'));
  const atRiskMrr = atRisk.reduce((s, m) => s + m.mrr, 0);
  const totalMrr  = kpis.mrr;
  const packageColors = [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted];

  const chartMax  = Math.max(...revenueMonthly.map(m => m.total), 1);
  const chartData = revenueMonthly.map(m => ({ label: m.month, value: Math.round((m.total / chartMax) * 100), highlight: false }));
  if (chartData.length > 0) chartData[chartData.length - 1].highlight = true;

  const now    = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <>
    <div>
      <PageHeader
        title="Welcome back"
        subtitle={`${tenantName} · ${kpis.activeMembers} active members`}
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={() => {
              exportCsv(`members-${new Date().toISOString().slice(0, 10)}.csv`,
                members as unknown as Record<string, unknown>[],
                [
                  { label: 'Name', key: 'name' }, { label: 'Age', key: 'age' },
                  { label: 'Parent', key: 'parent' }, { label: 'Program', key: 'program' },
                  { label: 'Status', key: 'status' }, { label: 'MRR', key: 'mrr' },
                  { label: 'Lifetime', key: 'lifetime' }, { label: 'Joined', key: 'joinedDate' },
                ]);
              setToast(`Exported ${members.length} members as CSV`);
            }}>Export</OButton>
            <OButton variant="gold" icon={Plus} onClick={() => router.push('/owner/members')}>New Member</OButton>
          </>
        }
      />

      {stripeConnected === false && !stripeBannerDismissed && (
        <div style={{
          margin: '0 24px',
          padding: '12px 16px',
          borderRadius: 8,
          background: brand.warningBg,
          border: `1px solid ${brand.warning}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <CreditCard size={16} color={brand.warning} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: brand.text }}>
            <strong>Card payments are not yet enabled.</strong>
            {' '}Connect a Stripe account to allow parents to pay by card.
          </div>
          <OButton
            variant="secondary"
            size="sm"
            onClick={() => router.push('/owner/payments')}
          >
            Set Up Payments →
          </OButton>
          <button
            onClick={() => setStripeBannerDismissed(true)}
            aria-label="Dismiss"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              color: brand.textMuted,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR"             value={`$${totalMrr.toLocaleString()}`}       icon={DollarSign}    color="gold" />
          <KPICard label="Active Members"  value={kpis.activeMembers}                     icon={Users} />
          <KPICard label="Retention Rate"  value={`${kpis.retentionRate}%`}               icon={TrendingUp}    color={kpis.retentionRate >= 85 ? 'success' : 'warning'} />
          <KPICard label="At Risk"         value={atRisk.length}                          icon={AlertTriangle} color="warning" />
          <KPICard label="Failed Payments" value={kpis.failedPaymentsCount}               icon={AlertCircle}   color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* ── Left column ── */}
          <div>
            <SectionHeader title="Revenue — History" action={<OButton variant="ghost" size="sm">Compare</OButton>} />
            <OCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>${totalMrr.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>Active monthly recurring revenue</div>
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>{months[now.getMonth()]} {now.getFullYear()}</div>
              </div>
              <BarChart data={chartData} height={180} />
            </OCard>

            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Financial Overview"
                subtitle="Month-to-date collected and auto-pay health"
                action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/billing')}>Full Breakdown →</OButton>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Collected card */}
                <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>THIS MONTH · COLLECTED</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5, color: brand.darker }}>${kpis.collectedMtd.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Net collected so far</div>
                    </div>
                    <Chip color="success">{months[now.getMonth()].toUpperCase()}</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {([
                      { label: 'Auto-pay rate',   value: `${kpis.autoPayRate}%`,               color: brand.success },
                      { label: 'Past due',         value: `$${kpis.pastDue.toLocaleString()}`,   color: kpis.pastDue > 0 ? brand.danger : undefined },
                      { label: 'Failed payments',  value: String(kpis.failedPaymentsCount),      color: kpis.failedPaymentsCount > 0 ? brand.danger : undefined },
                    ] as Array<{ label: string; value: string; color?: string }>).map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: brand.textMuted }}>{row.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>MRR</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.success }}>${totalMrr.toLocaleString()}</span>
                    </div>
                  </div>
                </OCard>

                {/* Forecast card */}
                <OCard style={{ background: `linear-gradient(135deg, ${brand.infoBg} 0%, ${brand.white} 100%)`, borderColor: brand.info }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.info, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>NEXT MONTH · FORECAST</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5, color: brand.darker }}>${Math.round(totalMrr * 1.02).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Based on current MRR</div>
                    </div>
                    <Chip color="info">FORECAST</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {([
                      { label: 'Opening MRR',            value: `$${totalMrr.toLocaleString()}`,                    color: undefined },
                      { label: 'Expected new signups',    value: `+$${(kpis.newSignupsMtd * 280).toLocaleString()}`, color: brand.success },
                      { label: 'At-risk churn exposure',  value: `-$${Math.round(atRiskMrr).toLocaleString()}`,      color: brand.danger },
                    ] as Array<{ label: string; value: string; color?: string }>).map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: brand.textMuted }}>{row.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.info }}>${Math.max(0, Math.round(totalMrr - atRiskMrr)).toLocaleString()}</span>
                    </div>
                  </div>
                </OCard>
              </div>
            </div>

            {/* Revenue by program */}
            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Revenue by Program"
                action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/revenue-reports')}>Full Report →</OButton>}
              />
              <OCard>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DonutChart
                      data={packages.map((p, i) => ({ value: Math.max(p.mrr, 1), color: packageColors[i % packageColors.length] }))}
                      size={160}
                    />
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: brand.textMuted, letterSpacing: 1, fontWeight: 700 }}>TOTAL</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>${totalMrr.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {packages.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < packages.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: packageColors[i % packageColors.length] }} />
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>${p.mrr.toLocaleString()}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, width: 48, textAlign: 'right' }}>{p.pctRevenue}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </OCard>
            </div>
          </div>

          {/* ── Right column ── */}
          <div>
            <div onClick={() => router.push('/owner/at-risk')} style={{ cursor: 'pointer', marginBottom: 20 }}>
              <SectionHeader title="At-Risk Members" action={<div style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700 }}>View All →</div>} />
              <OCard style={{ background: `linear-gradient(135deg, ${brand.dangerBg} 0%, ${brand.warningBg} 100%)`, borderColor: brand.warning }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.danger, color: brand.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={22} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display }}>{atRisk.length} member{atRisk.length !== 1 ? 's' : ''} at risk</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>${atRiskMrr.toLocaleString()} monthly revenue at risk</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {atRisk.filter(m => m.churnRisk === 'high').slice(0, 3).map(m => (
                    <div key={m.id} style={{ padding: 8, background: brand.surface, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{m.name.charAt(0)}</div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}><PlayerLink name={m.name} reference={{ kidId: m.kidId, membershipId: m.id }} /></div>
                      <div style={{ fontSize: 10, color: brand.danger, fontWeight: 700 }}>{m.lastSession}</div>
                    </div>
                  ))}
                </div>
              </OCard>
            </div>

            <SectionHeader title="Today at a Glance" />
            <OCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { Icon: Calendar,    label: 'Sessions Today',  value: String(kpis.sessionsToday),                    badge: `${kpis.utilizationPct}% util`,  ok: true  },
                  { Icon: CheckCircle2,label: 'Paid Today',      value: `$${kpis.paidToday.toLocaleString()}`,         badge: `${kpis.paidTodayCount} txns`,   ok: true  },
                  { Icon: Users,       label: 'New Signups MTD', value: String(kpis.newSignupsMtd),                    badge: `${kpis.newSignupsDelta >= 0 ? '+' : ''}${kpis.newSignupsDelta} vs last mo`, ok: kpis.newSignupsDelta >= 0 },
                  { Icon: XCircle,     label: 'Churned MTD',     value: String(kpis.churnedMtd),                       badge: kpis.churnedMrrImpact > 0 ? `-$${kpis.churnedMrrImpact.toLocaleString()} MRR` : 'No churn', ok: kpis.churnedMrrImpact === 0 },
                ].map(({ Icon, label, value, badge, ok }, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.goldDeep}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} color={brand.goldDeep} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{value}</div>
                      </div>
                    </div>
                    <div style={{ padding: '3px 8px', borderRadius: 12, background: ok ? brand.successBg : brand.dangerBg, color: ok ? brand.success : brand.danger, fontSize: 10, fontWeight: 700 }}>{badge}</div>
                  </div>
                ))}
              </div>
            </OCard>

            {/* ── Pack lifecycle quick links ── */}
            <div style={{ marginTop: 24 }}>
              <SectionHeader title="Pack Lifecycle" subtitle="OTC membership health" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { Icon: XCircle,  label: 'Cancellations',     sub: 'Recent cancellations & lost MRR',       href: '/owner/cancellations',     color: brand.danger },
                  { Icon: Clock,    label: 'Expiring Packs',    sub: 'Packs expiring in the next 60 days',     href: '/owner/expiring-packs',    color: brand.warning },
                  { Icon: Battery,  label: 'Low Balance Packs', sub: 'Packs running low — renewal opps',       href: '/owner/low-balance-packs', color: brand.goldDeep },
                ].map(({ Icon, label, sub, href, color }) => (
                  <div
                    key={href}
                    onClick={() => router.push(href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 12, background: brand.surfaceAlt,
                      borderRadius: 10, border: `1px solid ${brand.border}`,
                      cursor: 'pointer', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = brand.borderStrong)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = brand.border)}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={16} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: brand.text }}>{label}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{sub}</div>
                    </div>
                    <div style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700 }}>→</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
