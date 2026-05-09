'use client';

import { use } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { demoData } from '@/lib/ownerDemoData';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, MiniLineChart, Chip } from '@/components/owner/ui';
import {
  Calendar, MessageCircle, Edit2, Clock, Activity, Zap, Target,
  Sparkles, Flame, CreditCard,
} from 'lucide-react';

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const memberId = parseInt(id, 10);
  const m = demoData.members.find(mem => mem.id === memberId) ?? demoData.members[0];

  return (
    <div>
      <PageHeader
        breadcrumb={`Members → ${m.name}`}
        title={m.name}
        subtitle={`${m.age}U · ${m.program} · Member for 16 months · 27 total sessions · LTV $${m.lifetime.toLocaleString()}`}
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
            <KPICard label="Sessions Done" value="27" deltaLabel="lifetime" icon={Calendar} color="gold" />
            <KPICard label="Member For" value="16" unit="mo" deltaLabel={`since ${m.joinedDate}`} icon={Clock} />
            <KPICard label="Engagement" value={m.engagementScore} unit="/100" color="success" icon={Activity} />
            <KPICard label="Best Velo" value="68" unit="mph" color="gold" icon={Zap} />
            <KPICard label="Homework" value="8/10" icon={Target} color="success" />
          </div>

          <SectionHeader title="HitTrax Performance" action={<OButton variant="ghost" size="sm">View All Swings</OButton>} />
          <OCard>
            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              {[
                { label: 'AVG EXIT VELO', value: '65.2 mph', meta: '↑ +4 mph this quarter', metaColor: brand.success },
                { label: 'BEST', value: '68 mph', meta: 'Oct 18, 2025', metaColor: brand.textMuted, valueColor: brand.goldDeep },
                { label: 'LAUNCH ANGLE', value: '13°', meta: 'Optimal range', metaColor: brand.success },
              ].map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>{s.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4, color: s.valueColor }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: s.metaColor, fontWeight: 700, marginTop: 2 }}>{s.meta}</div>
                </div>
              ))}
            </div>
            <MiniLineChart data={[58, 61, 59, 63, 65, 64, 66, 68]} height={100} color={brand.goldDeep} />
          </OCard>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Activity Timeline" />
            <OCard padding={0}>
              {[
                { time: 'Today, 5:00 PM', icon: Calendar, title: 'Session scheduled', detail: 'Hitting with Coach Mike · Cage 3', color: brand.info },
                { time: 'Yesterday', icon: Sparkles, title: 'Earned 25 points', detail: 'Completed homework: Tee drills', color: brand.goldDeep },
                { time: 'Oct 18', icon: Zap, title: 'New personal best', detail: 'Exit velo: 68 mph (was 66)', color: brand.success },
                { time: 'Oct 18', icon: Calendar, title: 'Session completed', detail: '28 swings tracked via HitTrax', color: brand.info },
                { time: 'Oct 15', icon: CreditCard, title: 'Payment processed', detail: `$${m.mrr} monthly charge · Visa 4242`, color: brand.textMuted },
                { time: 'Oct 14', icon: Flame, title: 'Streak milestone', detail: '14 days active (+30 points)', color: brand.warning },
              ].map((e, i, arr) => (
                <div key={i} style={{ padding: '14px 18px', display: 'flex', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: `${e.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <e.icon size={14} color={e.color} strokeWidth={2.5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted }}>{e.time}</div>
                    </div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{e.detail}</div>
                  </div>
                </div>
              ))}
            </OCard>
          </div>
        </div>

        <div>
          <SectionHeader title="Contact" />
          <OCard>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Parent', value: m.parent, large: true },
                { label: 'Email', value: 'sarah.r@email.com' },
                { label: 'Phone', value: '(214) 555-8123' },
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
                <Chip color={m.status === 'active' ? 'success' : 'danger'}>{m.status}</Chip>
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
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>${m.mrr}<span style={{ fontSize: 12, color: brand.textMuted }}>/mo</span></div>
              <div style={{ marginTop: 14, padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                {[
                  { label: 'Next charge', value: m.nextCharge },
                  { label: 'Method', value: 'Visa •4242' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{row.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: row.value === 'Overdue' ? brand.danger : brand.text }}>{row.value}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Auto-pay</div>
                  <Chip color="success" size="sm">ON</Chip>
                </div>
              </div>
            </OCard>
          </div>
        </div>
      </div>
    </div>
  );
}
