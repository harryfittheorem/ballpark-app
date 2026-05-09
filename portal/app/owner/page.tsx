'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import {
  KPICard, OButton, PageHeader, SectionHeader, OCard, BarChart, DonutChart, Chip,
} from '@/components/owner/ui';
import {
  DollarSign, Users, TrendingUp, AlertTriangle, AlertCircle,
  Download, Plus, Calendar, CheckCircle2, XCircle,
} from 'lucide-react';

export default function OwnerDashboard() {
  const router = useRouter();
  const k = demoData.ownerKPIs;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${demoData.owner.name.split(' ')[0]}`}
        subtitle={`${demoData.location.name} · ${demoData.location.members} active members`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>New Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${(k.mrr / 1000).toFixed(1)}K`} delta={k.mrrDelta} icon={DollarSign} color="gold" />
          <KPICard label="Active Members" value={k.activeMembers} delta={k.membersDelta} icon={Users} />
          <KPICard label="Retention Rate" value={`${k.retentionRate}%`} delta={k.retentionDelta} icon={TrendingUp} color="success" />
          <KPICard label="At Risk" value={k.atRiskCount} icon={AlertTriangle} color="warning" />
          <KPICard label="Failed Payments" value={k.failedPayments} icon={AlertCircle} color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader
              title="Revenue — Last 12 Months"
              action={<OButton variant="ghost" size="sm">Compare</OButton>}
            />
            <OCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>$80,360</div>
                  <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>↑ 8.2% vs September</div>
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>October 2025</div>
              </div>
              <BarChart data={[
                { label: 'Nov', value: 62 }, { label: 'Dec', value: 64 }, { label: 'Jan', value: 68 },
                { label: 'Feb', value: 71 }, { label: 'Mar', value: 69 }, { label: 'Apr', value: 72 },
                { label: 'May', value: 74 }, { label: 'Jun', value: 71 }, { label: 'Jul', value: 73 },
                { label: 'Aug', value: 76 }, { label: 'Sep', value: 74 }, { label: 'Oct', value: 80, highlight: true },
              ]} height={180} />
            </OCard>

            <div style={{ marginTop: 24 }}>
              <SectionHeader
                title="Financial Forecast"
                subtitle="Projected auto-collect minus cancellations & declines"
                action={<OButton variant="ghost" size="sm" onClick={() => router.push('/owner/billing')}>Full Breakdown →</OButton>}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <OCard style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>THIS MONTH · PROJECTED</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>${(demoData.forecast.thisMonth.netProjected / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Net after declines & cancellations</div>
                    </div>
                    <Chip color="success">OCT</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {[
                      { label: 'Collected so far', value: `$${demoData.forecast.thisMonth.collectedSoFar.toLocaleString()}`, color: brand.success },
                      { label: 'Remaining to collect', value: `$${demoData.forecast.thisMonth.remainingToCollect.toLocaleString()}`, color: undefined },
                      { label: 'Expected declines', value: `−$${demoData.forecast.thisMonth.projectedDeclines.toLocaleString()}`, color: brand.danger },
                      { label: 'Expected cancellations', value: `−$${demoData.forecast.thisMonth.projectedCancellations.toLocaleString()}`, color: brand.danger },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: brand.textMuted }}>{row.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.success }}>${demoData.forecast.thisMonth.netProjected.toLocaleString()}</span>
                    </div>
                  </div>
                </OCard>

                <OCard style={{ background: `linear-gradient(135deg, ${brand.infoBg} 0%, ${brand.white} 100%)`, borderColor: brand.info }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.info, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>NEXT MONTH · FORECAST</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>${(demoData.forecast.nextMonth.projectedNet / 1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.forecast.nextMonth.confidence}% confidence</div>
                    </div>
                    <Chip color="info">NOV</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    {[
                      { label: 'Opening MRR', value: `$${demoData.forecast.nextMonth.openingMRR.toLocaleString()}`, color: undefined },
                      { label: 'Expected new signups', value: `+$${demoData.forecast.nextMonth.expectedNewSignups.toLocaleString()}`, color: brand.success },
                      { label: 'Expected churn', value: `−$${demoData.forecast.nextMonth.expectedChurn.toLocaleString()}`, color: brand.danger },
                      { label: 'Expected declines', value: `−$${demoData.forecast.nextMonth.expectedDeclines.toLocaleString()}`, color: brand.danger },
                    ].map((row, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: brand.textMuted }}>{row.label}</span>
                        <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: row.color }}>{row.value}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.info }}>${demoData.forecast.nextMonth.projectedNet.toLocaleString()}</span>
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
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DonutChart data={demoData.revenueByProgram.map((p, i) => ({
                      value: p.revenue,
                      color: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i],
                    }))} size={160} />
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: brand.textMuted, letterSpacing: 1, fontWeight: 700 }}>TOTAL</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display }}>$80.4K</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {demoData.revenueByProgram.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < demoData.revenueByProgram.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i] }} />
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>${(p.revenue / 1000).toFixed(1)}K</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, width: 48, textAlign: 'right' }}>{p.pctTotal}%</div>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display }}>8 members at risk</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>$2,240 monthly revenue at risk</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {demoData.members.filter(m => m.churnRisk === 'high').slice(0, 3).map(m => (
                    <div key={m.id} style={{ padding: 8, background: brand.surface, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {m.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{m.name}</div>
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
                  { icon: Calendar, color: brand.goldDeep, label: 'Sessions', value: '42', meta: '78% utilization', metaColor: brand.success },
                  { icon: CheckCircle2, color: brand.success, label: 'Paid today', value: '$1,840', meta: '7 charges', metaColor: brand.success },
                  { icon: Users, color: brand.info, label: 'New signups MTD', value: '18', meta: '+6 vs last', metaColor: brand.success },
                  { icon: XCircle, color: brand.danger, label: 'Churned MTD', value: '6', meta: '-$1,680 MRR', metaColor: brand.danger },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${row.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <row.icon size={16} color={row.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{row.value}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: row.metaColor, fontWeight: 700 }}>{row.meta}</div>
                  </div>
                ))}
              </div>
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
