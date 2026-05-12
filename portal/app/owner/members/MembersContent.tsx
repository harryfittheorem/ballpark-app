'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, Plus, Filter } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';

type Props = { members: OwnerMember[] };

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_MEMBERS: OwnerMember[] = [
  { id: 'd01', kidId: 'k01', name: 'Jake Martinez',    age: '12U', parent: 'Carlos Martinez',   program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 92, churnRisk: 'low',    lastSession: '2d ago',  nextCharge: 'Jun 1',   mrr: 280, lifetime: 3920, joinedDate: 'Jan 2025' },
  { id: 'd02', kidId: 'k02', name: 'Tyler Johnson',    age: '14U', parent: 'Brad Johnson',       program: 'Team Training',        planType: 'eft', status: 'active',    engagementScore: 60, churnRisk: 'high',   lastSession: '23d ago', nextCharge: 'Jun 5',   mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024', riskReason: '23 days since last session.' },
  { id: 'd03', kidId: 'k03', name: 'Marcus Williams',  age: '10U', parent: 'Darius Williams',    program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 41, churnRisk: 'high',   lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024', riskReason: '28 days without a session plus a failed payment.' },
  { id: 'd04', kidId: 'k04', name: 'Ryan Chen',        age: '11U', parent: 'David Chen',         program: '8-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 85, churnRisk: 'low',    lastSession: '5d ago',  nextCharge: '—',        mrr: 0,   lifetime: 1280, joinedDate: 'Feb 2025' },
  { id: 'd05', kidId: 'k05', name: 'Ethan Brooks',     age: '13U', parent: 'Kevin Brooks',       program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 63, churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3',   mrr: 120, lifetime: 960,  joinedDate: 'Jul 2024', riskReason: 'Attendance dropped significantly vs prior months.' },
  { id: 'd06', kidId: 'k06', name: 'Noah Patel',       age: '11U', parent: 'Raj Patel',          program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 55, churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8',   mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024' },
  { id: 'd07', kidId: 'k07', name: 'Logan Scott',      age: '9U',  parent: 'James Scott',        program: '4-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 78, churnRisk: 'low',    lastSession: '4d ago',  nextCharge: '—',        mrr: 0,   lifetime: 720,  joinedDate: 'Mar 2025' },
  { id: 'd08', kidId: 'k08', name: 'Aiden Torres',     age: '12U', parent: 'Maria Torres',       program: 'Team Training',        planType: 'eft', status: 'active',    engagementScore: 88, churnRisk: 'low',    lastSession: '1d ago',  nextCharge: 'Jun 2',   mrr: 450, lifetime: 4050, joinedDate: 'Apr 2024' },
  { id: 'd09', kidId: 'k09', name: 'Caleb Nguyen',     age: '13U', parent: 'Linh Nguyen',        program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 95, churnRisk: 'low',    lastSession: 'Today',   nextCharge: 'Jun 10',  mrr: 280, lifetime: 5040, joinedDate: 'Nov 2023' },
  { id: 'd10', kidId: 'k10', name: 'Jaxon Rivera',     age: '10U', parent: 'Sofia Rivera',       program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 70, churnRisk: 'low',    lastSession: '7d ago',  nextCharge: 'Jun 6',   mrr: 120, lifetime: 1080, joinedDate: 'Aug 2024' },
  { id: 'd11', kidId: 'k11', name: 'Owen Murphy',      age: '15U', parent: 'Patrick Murphy',     program: 'Team Training',        planType: 'eft', status: 'paused',    engagementScore: 30, churnRisk: 'high',   lastSession: '35d ago', nextCharge: '—',        mrr: 0,   lifetime: 2250, joinedDate: 'May 2024' },
  { id: 'd12', kidId: 'k12', name: 'Liam Perez',       age: '11U', parent: 'Ana Perez',          program: '8-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 82, churnRisk: 'low',    lastSession: '3d ago',  nextCharge: '—',        mrr: 0,   lifetime: 960,  joinedDate: 'Jan 2025' },
  { id: 'd13', kidId: 'k13', name: 'Zane Harris',      age: '14U', parent: 'Terry Harris',       program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 77, churnRisk: 'low',    lastSession: '6d ago',  nextCharge: 'Jun 12',  mrr: 280, lifetime: 3360, joinedDate: 'Feb 2024' },
  { id: 'd14', kidId: 'k14', name: 'Carter Simmons',   age: '12U', parent: 'Gina Simmons',       program: '4-Pack Lessons',       planType: 'otc', status: 'cancelled', engagementScore: 0,  churnRisk: 'high',   lastSession: '52d ago', nextCharge: '—',        mrr: 0,   lifetime: 540,  joinedDate: 'Oct 2024' },
  { id: 'd15', kidId: 'k15', name: 'Hunter Davis',     age: '13U', parent: 'Todd Davis',         program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 68, churnRisk: 'low',    lastSession: '9d ago',  nextCharge: 'Jun 4',   mrr: 120, lifetime: 1320, joinedDate: 'Sep 2024' },
];

// ── Table columns ──────────────────────────────────────────────────────────

const columns: TableColumn<OwnerMember & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'name', sortable: true,
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>
          {(r.name as string).charAt(0)}
        </div>
        <div>
          <div style={{ fontWeight: 700 }}>{r.name as string}</div>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age as string} · {r.parent as string}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Program', key: 'program', sortable: true,
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.program as string}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr as number}/mo · {(r.planType as string).toUpperCase()}</div>
      </div>
    ),
  },
  {
    label: 'Status', key: 'status', sortable: true,
    render: (r) => (
      <Chip color={r.status === 'active' ? 'success' : r.status === 'paused' ? 'warning' : 'danger'}>
        {r.status as string}
      </Chip>
    ),
  },
  {
    label: 'Engagement', key: 'engagementScore', sortable: true,
    render: (r) => {
      const score = r.engagementScore as number;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 60, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${score}%`, height: '100%', background: score >= 70 ? brand.success : score >= 50 ? brand.warning : brand.danger }} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{score}</div>
        </div>
      );
    },
  },
  {
    label: 'Risk', key: 'churnRisk', sortable: true,
    render: (r) => (
      <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">
        {r.churnRisk as string}
      </Chip>
    ),
  },
  {
    label: 'Last Session', key: 'lastSession',
    render: (r) => {
      const s = r.lastSession as string;
      const days = s.match(/^(\d+)d ago$/);
      const isOld = days ? parseInt(days[1]) > 14 : false;
      return <span style={{ fontSize: 11, color: isOld ? brand.danger : brand.textMuted, fontWeight: 600 }}>{s}</span>;
    },
  },
  {
    label: 'LTV', key: 'lifetime', align: 'right', sortable: true,
    render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.lifetime as number).toLocaleString()}</span>,
  },
  {
    label: 'Next Charge', key: 'nextCharge',
    render: (r) => (
      <span style={{ fontSize: 11, color: r.nextCharge === 'Overdue' ? brand.danger : brand.textMuted, fontWeight: 600 }}>
        {r.nextCharge as string}
      </span>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function MembersContent({ members: rawMembers }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const members = rawMembers.length ? rawMembers : DEMO_MEMBERS;

  const filtered = filter === 'all'    ? members
    : filter === 'at-risk' ? members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium')
    : members.filter(m => m.status === 'active');

  const tabs = [
    { id: 'all',     label: 'All Members', count: members.length },
    { id: 'active',  label: 'Active',      count: members.filter(m => m.status === 'active').length },
    { id: 'at-risk', label: 'At Risk',     count: members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium').length },
  ];

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${members.length} total · ${members.filter(m => m.status === 'active').length} active · ${members.filter(m => m.churnRisk === 'high').length} at high risk`}
        actions={
          <>
            <OButton variant="secondary" icon={Download}>Export</OButton>
            <OButton variant="gold" icon={Plus}>Add Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(f => (
            <div
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: filter === f.id ? brand.dark : brand.surface,
                color: filter === f.id ? brand.gold : brand.textMuted,
                border: `1px solid ${filter === f.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              }}
            >
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.count}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <OButton variant="secondary" size="sm" icon={Filter}>More Filters</OButton>
        </div>

        <OTable
          columns={columns as TableColumn<Record<string, unknown>>[]}
          rows={filtered as unknown as Record<string, unknown>[]}
          onRowClick={(row) => router.push(`/owner/members/${(row as unknown as OwnerMember).id}`)}
        />
      </div>
    </div>
  );
}
