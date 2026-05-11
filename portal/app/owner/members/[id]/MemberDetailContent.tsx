'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import {
  Calendar, MessageCircle, Edit2, Clock, Activity,
  Zap, Target, CreditCard,
} from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { member: OwnerMember };

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
            <KPICard label="Engagement" value={m.engagementScore} unit="/100" color="success" icon={Activity} />
            <KPICard label="Member For" value={m.joinedDate} deltaLabel="joined" icon={Clock} />
            <KPICard label="MRR" value={`$${m.mrr}`} deltaLabel="per month" icon={CreditCard} color="gold" />
            <KPICard label="LTV" value={`$${m.lifetime.toLocaleString()}`} deltaLabel="lifetime" icon={Zap} color="gold" />
            <KPICard label="Risk" value={m.churnRisk} icon={Target} color={m.churnRisk === 'low' ? 'success' : m.churnRisk === 'medium' ? 'warning' : 'danger'} />
          </div>

          <SectionHeader title="HitTrax Performance" subtitle="Swing data from HitTrax integration" action={<OButton variant="ghost" size="sm">View All Swings</OButton>} />
          <OCard>
            <div style={{ padding: 20, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
              HitTrax data will appear here once the athlete completes a tracked session.
            </div>
          </OCard>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Activity Timeline" />
            <OCard>
              <div style={{ padding: 16, fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${brand.border}` }}>
                  <span>Last session</span>
                  <strong style={{ color: m.churnRisk === 'high' ? brand.danger : brand.text }}>{m.lastSession}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${brand.border}` }}>
                  <span>Member since</span>
                  <strong style={{ color: brand.text }}>{m.joinedDate}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${brand.border}` }}>
                  <span>Plan type</span>
                  <strong style={{ color: brand.text }}>{m.planType.toUpperCase()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span>Next charge</span>
                  <strong style={{ color: m.nextCharge === 'Overdue' ? brand.danger : brand.text }}>{m.nextCharge}</strong>
                </div>
              </div>
            </OCard>
          </div>

          {m.riskReason && (
            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Risk Assessment" />
              <OCard style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>{m.riskReason}</div>
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
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
