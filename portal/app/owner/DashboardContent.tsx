'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  KPICard, OButton, PageHeader, SectionHeader, OCard, BarChart, DonutChart, Chip,
} from '@/components/owner/ui';
import {
  DollarSign, Users, TrendingUp, AlertTriangle, AlertCircle,
  Download, Plus, Calendar, CheckCircle2, XCircle,
} from 'lucide-react';
import type { OwnerKPIs, OwnerMember, RevenueMonth, MembershipPackage } from '@/lib/supabase/ownerQueries';

type Props = {
  kpis: OwnerKPIs;
  members: OwnerMember[];
  revenueMonthly: RevenueMonth[];
  packages: MembershipPackage[];
  locationName: string;
  tenantName: string;
};

export function DashboardContent({ kpis, members, revenueMonthly, packages, tenantName }: Props) {
  const router = useRouter();

  const atRisk = members.filter(m => m.status === 'active' && (m.churnRisk === 'high' || m.churnRisk === 'medium'));
  const atRiskMrr = atRisk.reduce((s, m) => s + m.mrr, 0);

  const totalMrr = kpis.mrr;
  const packageColors = [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted];

  const chartMax = Math.max(...revenueMonthly.map(m => m.total), 1);
  const chartData = revenueMonthly.map(m => ({
    label: m.month,
    value: Math.round((m.total / chartMax) * 100),
    highlight: false,
  }));
  if (chartData.length > 0) chartData[chartData.length - 1].highlight = true;

  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div>
      <PageHeader
        title={`Welcome back`}
        subtitle={`${tenantName} · ${kpis.activeMembers} active members`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>New Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${totalMrr.toLocaleString()}`} icon={DollarSign} color="gold" />
          <KPICard label="Active Members" value={kpis.activeMembers} icon={Users} />
          <KPICard label="Retention Rate" value={`${kpis.retentionRate}%`} icon={TrendingUp} color={kpis.retentionRate >= 85 ? 'success' : 'warning'} />
          <KPICard label="At Risk" value={atRisk.length} icon={AlertTriangle} color="warning" />
          <KPICard label="Failed Payments" value={kpis.failedPaymentsCount} icon={AlertCircle} color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader
              title="Revenue — History"
              action={<OButton variant="ghost" size="sm">Compare</OButton>}
            />
            <OCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>
                    ${totalMrr.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>
                    Active monthly recurring revenue
                  </div>
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>
                  {months[now.getMonth()]} {now.getFullYear()}
                </div>
              </div>
              {chartData.length > 0
                ? <BarChart data={chartData} height={180} />
                : <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: brand.textMuted, fontSize: 13 }}>No payment history yet</div>
              }
            </OCard>

            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Financial Overview"
                subtitle="Month-to-date collected and auto-pay health"
                action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/billing')}>Full Breakdown →</OButton>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>THIS MONTH · COLLECTED</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>${kpis.collectedMtd.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Net collected so far</div>
                    </div>
                    <Chip color="success">{months[now.getMonth()].toUpperCase()}</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {[
                      { label: 'Auto-pay rate', value: `${kpis.autoPayRate}%`, color: brand.success },
                      { label: 'Past due', value: `$${kpis.pastDue.toLocaleString()}`, color: kpis.pastDue > 0 ? brand.danger : undefined },
                      { label: 'Failed payments', value: String(kpis.failedPaymentsCount), color: kpis.failedPaymentsCount > 0 ? brand.danger : undefined },
                    ].map((row, i) => (
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

                <OCard style={{ background: `linear-gradient(135deg, ${brand.infoBg} 0%, ${brand.white} 100%)`, borderColor: brand.info }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.info, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>NEXT MONTH · FORECAST</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>
                        ${Math.round(totalMrr * 1.02).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Based on current MRR</div>
                    </div>
                    <Chip color="info">FORECAST</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {[
                      { label: 'Opening MRR', value: `$${totalMrr.toLocaleString()}`, color: undefined as string | undefined },
                      { label: 'Expected new signups', value: '+$0', color: brand.success },
                      { label: 'At-risk churn exposure', value: `-$${Math.round(atRiskMrr).toLocaleString()}`, color: brand.danger },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: brand.textMuted }}>{row.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.info }}>
                        ${Math.max(0, Math.round(totalMrr - atRiskMrr)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </OCard>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Revenue by Program"
                action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/revenue-reports')}>Full Report →</OButton>}
              />
              <OCard>
                {packages.length > 0 ? (
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
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>No package data yet</div>
                )}
              </OCard>
            </div>
          </div>

          <div>
            <div onClick={() => router.push('/owner/at-risk')} style={{ cursor: 'pointer', marginBottom: 20 }}>
              <SectionHeader
                title="At-Risk Members"
                action={<div style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700 }}>View All →</div>}
              />
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
                {atRisk.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {atRisk.filter(m => m.churnRisk === 'high').slice(0, 3).map(m => (
                      <div key={m.id} style={{ padding: 8, background: brand.surface, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 14, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                          {m.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{m.name}</div>
                        <div style={{ fontSize: 10, color: brand.danger, fontWeight: 700 }}>{m.lastSession}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: brand.textMuted, textAlign: 'center', padding: 12 }}>All members engaged</div>
                )}
              </OCard>
            </div>

            <SectionHeader title="Today at a Glance" />
            <OCard>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.goldDeep}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={16} color={brand.goldDeep} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>Sessions Today</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{kpis.sessionsToday}</div>
                    </div>
                  </div>
                  <div style={{ padding: '3px 8px', borderRadius: 12, background: brand.successBg, color: brand.success, fontSize: 10, fontWeight: 700 }}>{kpis.utilizationPct}% util</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.success}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={16} color={brand.success} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>Paid Today</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>${kpis.paidToday.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ padding: '3px 8px', borderRadius: 12, background: brand.successBg, color: brand.success, fontSize: 10, fontWeight: 700 }}>{kpis.paidTodayCount} txn{kpis.paidTodayCount !== 1 ? 's' : ''}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.info}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={16} color={brand.info} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>New Signups MTD</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{kpis.newSignupsMtd}</div>
                    </div>
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                    background: kpis.newSignupsDelta >= 0 ? brand.successBg : brand.dangerBg,
                    color: kpis.newSignupsDelta >= 0 ? brand.success : brand.danger,
                  }}>{kpis.newSignupsDelta >= 0 ? '+' : ''}{kpis.newSignupsDelta} vs last mo</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.danger}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <XCircle size={16} color={brand.danger} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>Churned MTD</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{kpis.churnedMtd}</div>
                    </div>
                  </div>
                  {kpis.churnedMrrImpact > 0
                    ? <div style={{ padding: '3px 8px', borderRadius: 12, background: brand.dangerBg, color: brand.danger, fontSize: 10, fontWeight: 700 }}>-${kpis.churnedMrrImpact.toLocaleString()} MRR</div>
                    : <div style={{ padding: '3px 8px', borderRadius: 12, background: brand.successBg, color: brand.success, fontSize: 10, fontWeight: 700 }}>No churn</div>
                  }
                </div>
              </div>
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
