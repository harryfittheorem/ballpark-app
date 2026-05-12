'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import {
  Calendar, MessageCircle, Edit2, Activity, Clock,
  CheckCircle, XCircle, CreditCard, Star, Zap, TrendingUp,
} from 'lucide-react';
import type { MemberDetail } from '@/lib/supabase/ownerQueries';
import type { DemoMemberDetail } from './demoMemberDetails';

type Props = { member: MemberDetail | DemoMemberDetail };

function isDemo(m: MemberDetail | DemoMemberDetail): m is DemoMemberDetail {
  return 'bestVeloMph' in m;
}

function monthsAgo(joinedDate: string): number {
  const parts = joinedDate.split(' ');
  if (parts.length < 2) return 0;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months.indexOf(parts[0]);
  const yr = parseInt(parts[1], 10);
  if (mon < 0 || isNaN(yr)) return 0;
  const now = new Date();
  return Math.max(1, (now.getFullYear() - yr) * 12 + (now.getMonth() - mon));
}

function KPIBlock({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: brand.surface,
      border: `1px solid ${brand.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        fontSize: 26,
        fontWeight: 800,
        fontFamily: fonts.display,
        color: highlight ? brand.success : brand.text,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: brand.textMuted }}>{sub}</div>}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 320;
  const h = 60;
  const pad = 8;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const fillD = `${d} L ${xs[xs.length-1].toFixed(1)} ${h} L ${xs[0].toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={brand.success} stopOpacity="0.18" />
          <stop offset="100%" stopColor={brand.success} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke={brand.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: large ? 15 : 13, fontWeight: large ? 700 : 500, color: brand.text }}>{value}</div>
    </div>
  );
}

export function MemberDetailContent({ member: m }: Props) {
  const demo = isDemo(m) ? m : null;
  const mo = demo ? demo.memberForMonths : monthsAgo(m.joinedDate);

  return (
    <div>
      <PageHeader
        breadcrumb={`Members → ${m.name}`}
        title={m.name}
        subtitle={`${m.age} · ${m.program} · Member for ${mo} months · ${m.bookingCount} total sessions · LTV $${m.lifetime.toLocaleString()}`}
        actions={
          <>
            <OButton variant="secondary" icon={MessageCircle}>Message</OButton>
            <OButton variant="secondary" icon={Edit2}>Edit</OButton>
            <OButton variant="gold" icon={Calendar}>Book Session</OButton>
          </>
        }
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* ── Left column ── */}
        <div>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
            <KPIBlock label="Sessions Done" value={m.bookingCount} sub="completed" />
            <KPIBlock label="Member For" value={mo} sub="months" />
            <KPIBlock label="Engagement" value={m.engagementScore} sub="out of 100" highlight={m.engagementScore >= 70} />
            <KPIBlock label="Best Velo" value={demo ? `${demo.bestVeloMph} mph` : '—'} sub="exit velocity" highlight />
            <KPIBlock label="Homework" value={demo ? `${demo.homeworkScore}/10` : '—'} sub="completion" />
          </div>

          {/* HitTrax Performance */}
          {demo && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionHeader title="HitTrax Performance" />
                <span style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 600, cursor: 'pointer' }}>VIEW ALL SWINGS</span>
              </div>
              <OCard style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Avg Exit Velo</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginTop: 2 }}>
                      {demo.hittraxAvgExitVelo} <span style={{ fontSize: 13, color: brand.textMuted }}>mph</span>
                    </div>
                    <div style={{ fontSize: 11, color: brand.success, marginTop: 2 }}>▲ +4 mph this quarter</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Best</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fonts.display, color: brand.success, marginTop: 2 }}>
                      {demo.hittraxBestVelo} <span style={{ fontSize: 13, color: brand.textMuted }}>mph</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Launch Angle</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginTop: 2 }}>
                      {demo.hittraxLaunchAngle}<span style={{ fontSize: 13, color: brand.textMuted }}>°</span>
                    </div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Optimal range</div>
                  </div>
                </div>
                <Sparkline points={demo.sparklinePoints} />
              </OCard>
            </div>
          )}

          {/* Activity Timeline */}
          <SectionHeader title="Activity Timeline" />
          <OCard>
            {m.timeline.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
                No activity on record yet.
              </div>
            ) : (
              m.timeline.map((evt, i) => {
                const isLast = i === m.timeline.length - 1;
                const isPmt = evt.kind === 'payment';
                const isGood = evt.status === 'completed' || evt.status === 'paid';
                const isBad = evt.status === 'cancelled' || evt.status === 'failed';
                const Icon = isPmt
                  ? (isGood ? CheckCircle : isBad ? XCircle : CreditCard)
                  : (isGood ? CheckCircle : isBad ? XCircle : Clock);
                const iconColor = isGood ? brand.success : isBad ? brand.danger : brand.textMuted;

                return (
                  <div
                    key={evt.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: !isLast ? `1px solid ${brand.border}` : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 15,
                        background: isGood ? brand.successBg : isBad ? brand.dangerBg : brand.surfaceAlt,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={14} color={iconColor} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: brand.text, fontSize: 13 }}>{evt.title}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{evt.subtitle}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: brand.textMuted, flexShrink: 0, marginLeft: 12 }}>
                      {evt.dateLabel}
                    </div>
                  </div>
                );
              })
            )}
          </OCard>

          {/* Risk assessment */}
          {m.riskReason && (
            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Risk Assessment" />
              <OCard style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.6, padding: '4px 0' }}>{m.riskReason}</div>
              </OCard>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contact */}
          <div>
            <SectionHeader title="Contact" />
            <OCard style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow label="Parent" value={m.parent} large />
                <InfoRow label="Email" value={demo?.parentEmail ?? '—'} />
                <InfoRow label="Phone" value={demo?.parentPhone ?? '—'} />
              </div>
            </OCard>
          </div>

          {/* Status chips */}
          <div>
            <SectionHeader title="Status" />
            <OCard style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Chip color={m.status === 'active' ? 'success' : m.status === 'paused' ? 'warning' : 'danger'}>
                  {m.status}
                </Chip>
                <Chip color={m.churnRisk === 'low' ? 'success' : m.churnRisk === 'medium' ? 'warning' : 'danger'}>
                  Risk: {m.churnRisk}
                </Chip>
              </div>
              <div style={{ fontSize: 11, color: brand.textMuted, lineHeight: 1.7 }}>
                Engagement: <strong style={{ color: brand.text }}>{m.engagementScore}/100</strong>
                <br />Last session: <strong style={{ color: brand.text }}>{m.lastSession}</strong>
              </div>
            </OCard>
          </div>

          {/* Billing */}
          <div>
            <SectionHeader title="Billing" />
            <OCard style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, fontFamily: fonts.display }}>{m.program.toUpperCase()}</div>
              {m.planType === 'eft' ? (
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginTop: 6 }}>
                  ${m.mrr}<span style={{ fontSize: 12, color: brand.textMuted, fontWeight: 400 }}>/mo</span>
                </div>
              ) : (
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.text, marginTop: 6 }}>
                  ${m.lifetime.toLocaleString()} <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 400 }}>one-time</span>
                </div>
              )}
              <div style={{ marginTop: 12, padding: 10, background: brand.surfaceAlt, borderRadius: 8 }}>
                {[
                  { label: 'Next charge', value: m.nextCharge },
                  { label: 'Method', value: demo?.paymentMethod ?? '—' },
                  { label: 'Auto-pay', value: m.planType === 'eft' ? 'ON' : '—' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{row.label}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: row.value === 'Overdue' ? brand.danger : row.value === 'ON' ? brand.success : brand.text,
                    }}>
                      {row.value === 'ON' ? (
                        <span style={{ background: brand.successBg, color: brand.success, padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>ON</span>
                      ) : row.value}
                    </div>
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
                        padding: '7px 0',
                        borderTop: i > 0 ? `1px solid ${brand.border}` : undefined,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: brand.text }}>${p.amount.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted }}>{p.date} · {p.method}</div>
                      </div>
                      <Chip color={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'} size="sm">
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
