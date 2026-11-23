'use client';
import { PlayerLink } from '@/components/owner/PlayerLink';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OTable } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Clock, AlertCircle, AlertTriangle, DollarSign, Download, Send, Phone, Mail, MessageCircle, CheckCircle2 } from 'lucide-react';
import type { MiaGroups, OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { groups: MiaGroups };

// ── Demo data ──────────────────────────────────────────────────────────────

const mk = (id: string, name: string, age: string, parent: string, program: string, planType: 'eft' | 'otc', mrr: number, lifetime: number, lastSession: string, joined: string, score: number): OwnerMember => ({
  id, kidId: id, name, age, parent, parentEmail: '', parentPhone: null, program, planType, status: 'active',
  engagementScore: score, churnRisk: score < 40 ? 'high' : 'medium',
  lastSession, nextCharge: mrr > 0 ? 'Jun 5' : '—', mrr, lifetime, joinedDate: joined,
  cardLast4: null, cardBrand: null, cardExpMonth: null, cardExpYear: null,
});

const DEMO_GROUPS: MiaGroups = {
  sevenDay: [
    mk('m1', 'Noah Patel',      '11U', 'Raj Patel',       'Unlimited Monthly',   'eft', 280, 2240, '15d ago', 'Jun 2024', 55),
    mk('m2', 'Ethan Brooks',    '13U', 'Kevin Brooks',    'Cage Rental Monthly', 'eft', 120, 960,  '16d ago', 'Jul 2024', 63),
    mk('m3', 'Zane Harris',     '14U', 'Terry Harris',    'Unlimited Monthly',   'eft', 280, 3360, '17d ago', 'Feb 2024', 52),
    mk('m4', 'Hunter Davis',    '13U', 'Todd Davis',      'Cage Rental Monthly', 'eft', 120, 1320, '18d ago', 'Sep 2024', 48),
    mk('m5', 'Liam Perez',      '11U', 'Ana Perez',       '8-Pack Lessons',      'otc', 0,   960,  '19d ago', 'Jan 2025', 44),
  ],
  fourteenDay: [
    mk('m6', 'Tyler Johnson',   '14U', 'Brad Johnson',    'Team Training',       'eft', 450, 5480, '23d ago', 'Mar 2024', 60),
    mk('m7', 'Jaxon Rivera',    '10U', 'Sofia Rivera',    'Cage Rental Monthly', 'eft', 120, 1080, '25d ago', 'Aug 2024', 36),
    mk('m8', 'Carter Simmons',  '12U', 'Gina Simmons',    '4-Pack Lessons',      'otc', 0,   540,  '27d ago', 'Oct 2024', 22),
  ],
  thirtyDay: [
    mk('m9',  'Marcus Williams', '10U', 'Darius Williams', 'Unlimited Monthly',  'eft', 280, 1680, '28d ago', 'Sep 2024', 41),
    mk('m10', 'Owen Murphy',     '15U', 'Patrick Murphy',  'Team Training',      'eft', 0,   2250, '35d ago', 'May 2024', 30),
  ],
};

// ── Table columns ──────────────────────────────────────────────────────────

const columns: TableColumn<OwnerMember & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'name',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>
          {(r.name as string).charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}><PlayerLink name={r.name} reference={{ kidId: r.kidId, membershipId: r.id }} /></div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age as string} · {r.parent as string}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Last Session', key: 'lastSession',
    render: (r) => {
      const s = r.lastSession as string;
      const days = s.match(/^(\d+)d ago$/);
      const n = days ? parseInt(days[1]) : 0;
      return <div style={{ fontSize: 13, fontWeight: 700, color: n >= 14 ? brand.danger : brand.warning }}>{s}</div>;
    },
  },
  {
    label: 'Program', key: 'program',
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.program as string}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr as number}/mo</div>
      </div>
    ),
  },
  {
    label: 'LTV', key: 'lifetime', align: 'right',
    render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.lifetime as number).toLocaleString()}</span>,
  },
  {
    label: 'Joined', key: 'joinedDate',
    render: (r) => <span style={{ fontSize: 12 }}>{r.joinedDate as string}</span>,
  },
  {
    label: 'Engagement', key: 'engagementScore',
    render: (r) => {
      const score = r.engagementScore as number;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 50, height: 5, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: score >= 60 ? brand.warning : brand.danger }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{score}</div>
        </div>
      );
    },
  },
  {
    label: 'Actions', key: 'id',
    render: () => (
      <div style={{ display: 'flex', gap: 4 }}>
        <OButton variant="gold"      size="sm" icon={Phone}>Call</OButton>
        <OButton variant="secondary" size="sm" icon={Mail}>Email</OButton>
        <OButton variant="ghost"     size="sm" icon={MessageCircle} />
      </div>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function MissingInActionContent({ groups: rawGroups }: Props) {
  const [tab, setTab] = useState<'7' | '14' | '30'>('7');

  const hasLiveData = rawGroups.sevenDay.length > 0 || rawGroups.fourteenDay.length > 0 || rawGroups.thirtyDay.length > 0;
  const groups = rawGroups;

  const current = groups[tab === '7' ? 'sevenDay' : tab === '14' ? 'fourteenDay' : 'thirtyDay'];

  const totalRevenueAtRisk = [
    ...groups.sevenDay, ...groups.fourteenDay, ...groups.thirtyDay,
  ].reduce((s, m) => s + m.mrr, 0);

  const tabDefs = [
    { id: '7'  as const, label: '7+ Days',  count: groups.sevenDay.length,    color: brand.warning },
    { id: '14' as const, label: '14+ Days', count: groups.fourteenDay.length,  color: brand.warning },
    { id: '30' as const, label: '30+ Days', count: groups.thirtyDay.length,    color: brand.danger  },
  ];

  return (
    <div>
      <PageHeader
        title="Missing in Action"
        subtitle="Attendance-based early warning · Early intervention dramatically improves retention"
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Send}>Send Group Email</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Missing 7+ Days"  value={groups.sevenDay.length}    icon={Clock}         color="warning" />
          <KPICard label="Missing 14+ Days" value={groups.fourteenDay.length}  icon={AlertCircle}   color="warning" />
          <KPICard label="Missing 30+ Days" value={groups.thirtyDay.length}    icon={AlertTriangle} color="danger" />
          <KPICard label="Revenue at Risk"  value={`$${totalRevenueAtRisk.toLocaleString()}`} deltaLabel="monthly" icon={DollarSign} color="danger" />
        </div>

        <div style={{ padding: 14, background: brand.infoBg, borderRadius: 10, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.info, color: brand.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: brand.text, flex: 1 }}>
            <strong>Why this matters:</strong> Youth sports members who miss 14+ days have a 68% probability of churning within the next 30 days. Members who miss 30+ days churn 82% of the time. <strong>A single outreach call recovers roughly 1 in 3.</strong>
          </div>
        </div>

        <div className="portal-sticky-tabs portal-sticky-tab-row" role="tablist" aria-label="Days missing filter" style={{ marginBottom: 20 }}>
          {tabDefs.map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: tab === t.id ? brand.dark : brand.surface,
                color: tab === t.id ? brand.gold : brand.textMuted,
                border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {t.label}
              <div style={{ padding: '2px 8px', borderRadius: 10, background: tab === t.id ? brand.gold : `${t.color}22`, color: tab === t.id ? brand.dark : t.color, fontSize: 11, fontWeight: 800, fontFamily: fonts.display }}>
                {t.count}
              </div>
            </div>
          ))}
        </div>

        <SectionHeader title={`Members missing ${tab}+ days`} subtitle="Sorted by last session date — oldest first" />

        {current.length > 0 ? (
          <OTable
            columns={columns as TableColumn<Record<string, unknown>>[]}
            rows={current as unknown as Record<string, unknown>[]}
          />
        ) : (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={48} color={brand.success} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No members in this group</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Great attendance. Keep it up.</div>
          </div>
        )}
      </div>
    </div>
  );
}
