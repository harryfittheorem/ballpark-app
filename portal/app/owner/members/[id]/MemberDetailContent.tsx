'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import {
  Calendar, MessageCircle, Edit2, Activity,
  Zap, Target, CreditCard, Database, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import type { MemberDetail } from '@/lib/supabase/ownerQueries';

type Props = { member: MemberDetail };

function timelineStatusColor(kind: 'booking' | 'payment', status: string): string {
  if (kind === 'payment') {
    return status === 'paid' ? brand.success : status === 'failed' ? brand.danger : brand.warning;
  }
  return status === 'completed' ? brand.success : status === 'cancelled' ? brand.danger : brand.textMuted;
}

export function MemberDetailContent({ member: m }: Props) {
  return (
    <div>
      <PageHeader
        breadcrumb={`Members → ${m.name}`}
        title={m.name}
        subtitle={`${m.age} · ${m.program} · Joined ${m.joinedDate} · LTV $${m.lifetime.toLocaleString()}`}
        actions={
          <>
            <OButton variant="secondary" icon={MessageCircle}>Message</OButton>
            <OButton variant="secondary" icon={Edit2}>Edit</OButton>
            <OButton variant="gold" icon={Calendar}>Book Session</OButton>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            <KPICard label="Sessions" value={m.bookingCount} unit=" completed" color="success" icon={Activity} />
            <KPICard label="HitTrax" value={m.hittraxSessionCount} unit=" sessions" icon={Database} />
            <KPICard label="Points" value={m.pointsBalance.toLocaleString()} deltaLabel="balance" icon={Zap} color="gold" />
            <KPICard label="MRR" value={`$${m.mrr}`} deltaLabel="per month" icon={CreditCard} color="gold" />
            <KPICard label="Risk" value={m.churnRisk} icon={Target} color={m.churnRisk === 'low' ? 'success' : m.churnRisk === 'medium' ? 'warning' : 'danger'} />
          </div>

          <SectionHeader title="Activity Timeline" subtitle="Recent bookings and payment events" />
          <OCard>
            {m.timeline.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
                No activity on record yet.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
                {m.timeline.map((evt, i) => {
                  const isLast = i === m.timeline.length - 1;
                  const iconColor = timelineStatusColor(evt.kind, evt.status);
                  const Icon = evt.kind === 'payment'
                    ? (evt.status === 'paid' ? CheckCircle : evt.status === 'failed' ? XCircle : CreditCard)
                    : (evt.status === 'completed' ? CheckCircle : evt.status === 'cancelled' ? XCircle : Clock);

                  return (
                    <div
                      key={evt.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 16px',
                        borderBottom: !isLast ? `1px solid ${brand.border}` : undefined,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon size={14} color={iconColor} />
                        <div>
                          <div style={{ fontWeight: 600, color: brand.text }}>{evt.title}</div>
                          <div style={{ fontSize: 11 }}>{evt.subtitle}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>{evt.dateLabel}</div>
                        <Chip
                          color={
                            evt.status === 'completed' || evt.status === 'paid' ? 'success'
                            : evt.status === 'cancelled' || evt.status === 'failed' ? 'danger'
                            : 'info'
                          }
                          size="sm"
                        >
                          {evt.kind === 'payment' ? evt.status : evt.status}
                        </Chip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </OCard>

          {m.riskReason && (
            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Risk Assessment" />
              <OCard style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.6, padding: '4px 0' }}>{m.riskReason}</div>
              </OCard>
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="Contact" />
          <OCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Parent', value: m.parent, large: true },
                { label: 'Age Group', value: m.age },
                { label: 'Program', value: m.program },
              ].map((row, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{row.label}</div>
                  <div style={{ fontSize: row.large ? 14 : 12, fontWeight: row.large ? 700 : 500, marginTop: 2 }}>{row.value}</div>
                </div>
              ))}
            </div>
          </OCard>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Status" />
            <OCard>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <Chip color={m.status === 'active' ? 'success' : m.status === 'at-risk' ? 'danger' : 'warning'}>{m.status}</Chip>
                <Chip color={m.churnRisk === 'low' ? 'success' : m.churnRisk === 'medium' ? 'warning' : 'danger'}>Risk: {m.churnRisk}</Chip>
              </div>
              <div style={{ fontSize: 11, color: brand.textMuted, lineHeight: 1.6 }}>
                Engagement score: <strong style={{ color: brand.text }}>{m.engagementScore}/100</strong>
                <br />Last session: <strong style={{ color: brand.text }}>{m.lastSession}</strong>
              </div>
            </OCard>
          </div>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Billing" />
            <OCard>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontFamily: fonts.display }}>{m.program.toUpperCase()}</div>
              {m.planType === 'eft' ? (
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>${m.mrr}<span style={{ fontSize: 12, color: brand.textMuted }}>/mo</span></div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>${m.mrr}<span style={{ fontSize: 12, color: brand.textMuted }}> upfront</span></div>
              )}
              <div style={{ marginTop: 14, padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                {[
                  { label: 'Plan type', value: m.planType.toUpperCase() },
                  { label: 'Next charge', value: m.nextCharge },
                  { label: 'LTV to date', value: `$${m.lifetime.toLocaleString()}` },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{row.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: row.value === 'Overdue' ? brand.danger : brand.text }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {m.recentPayments.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>RECENT PAYMENTS</div>
                  {m.recentPayments.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0',
                        borderTop: i > 0 ? `1px solid ${brand.border}` : undefined,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: brand.text }}>${p.amount.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted }}>{p.date} · {p.method}</div>
                      </div>
                      <Chip
                        color={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {p.status}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
