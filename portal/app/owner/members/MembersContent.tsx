'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, Plus, Filter, X } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

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
    render: (r) => {
      const rawStatus = r.status as string;
      const label = rawStatus === 'payment_overdue' ? 'Payment Overdue'
        : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      const color = rawStatus === 'active' ? 'success'
        : rawStatus === 'paused' ? 'warning'
        : 'danger';
      return <Chip color={color}>{label}</Chip>;
    },
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
    label: 'Last Session', key: 'lastSession', sortable: true,
    render: (r) => <span style={{ fontSize: 12, color: brand.textMuted }}>{r.lastSession as string}</span>,
  },
  {
    label: 'Next Charge', key: 'nextCharge',
    render: (r) => {
      const v = r.nextCharge as string;
      return <span style={{ fontSize: 12, color: v === 'Overdue' ? brand.danger : brand.text, fontWeight: v === 'Overdue' ? 700 : 400 }}>{v}</span>;
    },
  },
  {
    label: 'MRR', key: 'mrr', sortable: true, align: 'right',
    render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{(r.mrr as number) > 0 ? `$${r.mrr as number}` : '—'}</span>,
  },
];

// ── Shared input style ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${brand.border}`,
  borderRadius: 7, fontSize: 13, color: brand.text, background: brand.surface,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

// ── Component ──────────────────────────────────────────────────────────────

export function MembersContent({ members }: Props) {
  const router  = useRouter();
  const source  = members.length ? members : DEMO_MEMBERS;
  const [filter, setFilter] = useState<'all' | 'active' | 'at-risk'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast]   = useState<string | null>(null);
  const [form, setForm]     = useState({
    parentName: '', parentEmail: '', kidName: '',
    ageGroup: '12U', program: 'Unlimited Monthly', planType: 'eft',
  });

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const filtered = source.filter(m => {
    if (filter === 'active')  return m.status === 'active';
    if (filter === 'at-risk') return m.churnRisk === 'high' || m.churnRisk === 'medium';
    return true;
  });

  const tabs = [
    { id: 'all',     label: 'All',     count: source.length },
    { id: 'active',  label: 'Active',  count: source.filter(m => m.status === 'active').length },
    { id: 'at-risk', label: 'At Risk', count: source.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium').length },
  ];

  const handleExport = () => {
    exportCsv(`members-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered as unknown as Record<string, unknown>[],
      [
        { label: 'Name',       key: 'name' },
        { label: 'Age',        key: 'age' },
        { label: 'Parent',     key: 'parent' },
        { label: 'Program',    key: 'program' },
        { label: 'Plan',       key: 'planType' },
        { label: 'Status',     key: 'status' },
        { label: 'Engagement', key: 'engagementScore' },
        { label: 'Last Session', key: 'lastSession' },
        { label: 'Next Charge',  key: 'nextCharge' },
        { label: 'MRR',        key: 'mrr' },
        { label: 'Lifetime',   key: 'lifetime' },
        { label: 'Joined',     key: 'joinedDate' },
      ],
    );
    setToast(`Exported ${filtered.length} members as CSV`);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setShowAddModal(false);
    setForm({ parentName: '', parentEmail: '', kidName: '', ageGroup: '12U', program: 'Unlimited Monthly', planType: 'eft' });
    setToast(`Invitation sent to ${form.parentEmail} — ${form.kidName} will appear once they complete signup`);
  };

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${source.length} total · ${source.filter(m => m.status === 'active').length} active · ${source.filter(m => m.churnRisk === 'high').length} at high risk`}
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={handleExport}>Export</OButton>
            <OButton variant="gold" icon={Plus} onClick={() => setShowAddModal(true)}>Add Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(f => (
            <div
              key={f.id}
              onClick={() => setFilter(f.id as typeof filter)}
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

      {/* Add Member modal */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 480, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>Add New Member</div>
              <div onClick={() => setShowAddModal(false)} style={{ cursor: 'pointer', padding: 4 }}><X size={16} color={brand.textMuted} /></div>
            </div>
            <form onSubmit={handleAddMember} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Parent Name</label>
                  <input required style={inputStyle} value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))} placeholder="Carlos Martinez" />
                </div>
                <div>
                  <label style={labelStyle}>Parent Email</label>
                  <input required type="email" style={inputStyle} value={form.parentEmail} onChange={e => setForm(f => ({ ...f, parentEmail: e.target.value }))} placeholder="carlos@email.com" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Kid&apos;s Name</label>
                  <input required style={inputStyle} value={form.kidName} onChange={e => setForm(f => ({ ...f, kidName: e.target.value }))} placeholder="Jake Martinez" />
                </div>
                <div>
                  <label style={labelStyle}>Age Group</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}>
                    {['8U','9U','10U','11U','12U','13U','14U','15U','16U+'].map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Program</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={form.program} onChange={e => setForm(f => ({ ...f, program: e.target.value }))}>
                    {['Unlimited Monthly','Team Training','Cage Rental Monthly','8-Pack Lessons','4-Pack Lessons'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Plan Type</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={form.planType} onChange={e => setForm(f => ({ ...f, planType: e.target.value }))}>
                    <option value="eft">EFT (Monthly)</option>
                    <option value="otc">OTC (Upfront)</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <OButton variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</OButton>
                <OButton variant="gold" icon={Plus}>Send Invitation</OButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
