'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Download, Plus, Filter, X, CreditCard, AlertTriangle, UserPlus, Phone } from 'lucide-react';
import type { OwnerMember } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';
import { PlayerLink } from '@/components/owner/PlayerLink';

type Props = { members: OwnerMember[] };

// ── Card expiry helpers ─────────────────────────────────────────────────────

function isCardExpiringSoon(expMonth: number | null, expYear: number | null): boolean {
  if (!expMonth || !expYear) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthsUntilExpiry =
    (expYear - currentYear) * 12 + (expMonth - currentMonth);
  return monthsUntilExpiry <= 2 && monthsUntilExpiry >= 0;
}

function isCardExpired(expMonth: number | null, expYear: number | null): boolean {
  if (!expMonth || !expYear) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return expYear < currentYear || (expYear === currentYear && expMonth < currentMonth);
}

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_MEMBERS: OwnerMember[] = [
  { id: 'd01', kidId: 'k01', name: 'Jake Martinez',    age: '12U', parent: 'Carlos Martinez',   parentEmail: 'carlos@example.com',  parentPhone: '(312) 555-0101', program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 92, churnRisk: 'low',    lastSession: '2d ago',  nextCharge: 'Jun 1',   mrr: 280, lifetime: 3920, joinedDate: 'Jan 2025', cardLast4: '4242', cardBrand: 'Visa',       cardExpMonth: 12, cardExpYear: 2029 },
  { id: 'd02', kidId: 'k02', name: 'Tyler Johnson',    age: '14U', parent: 'Brad Johnson',       parentEmail: 'brad@example.com',    parentPhone: '(312) 555-0102', program: 'Team Training',        planType: 'eft', status: 'active',    engagementScore: 60, churnRisk: 'high',   lastSession: '23d ago', nextCharge: 'Jun 5',   mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024', cardLast4: '5555', cardBrand: 'Mastercard', cardExpMonth: 6,  cardExpYear: 2028, riskReason: '23 days since last session.' },
  { id: 'd03', kidId: 'k03', name: 'Marcus Williams',  age: '10U', parent: 'Darius Williams',    parentEmail: 'darius@example.com',  parentPhone: '(312) 555-0103', program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 41, churnRisk: 'high',   lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null, riskReason: '28 days without a session plus a failed payment.' },
  { id: 'd04', kidId: 'k04', name: 'Ryan Chen',        age: '11U', parent: 'David Chen',         parentEmail: 'david@example.com',   parentPhone: '(312) 555-0104', program: '8-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 85, churnRisk: 'low',    lastSession: '5d ago',  nextCharge: '—',        mrr: 0,   lifetime: 1280, joinedDate: 'Feb 2025', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd05', kidId: 'k05', name: 'Ethan Brooks',     age: '13U', parent: 'Kevin Brooks',       parentEmail: 'kevin@example.com',   parentPhone: '(312) 555-0105', program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 63, churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3',   mrr: 120, lifetime: 960,  joinedDate: 'Jul 2024', cardLast4: '4444', cardBrand: 'Mastercard', cardExpMonth: new Date().getMonth() + 2 > 12 ? new Date().getMonth() + 2 - 12 : new Date().getMonth() + 2, cardExpYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(), riskReason: 'Attendance dropped significantly vs prior months.' },
  { id: 'd06', kidId: 'k06', name: 'Noah Patel',       age: '11U', parent: 'Raj Patel',          parentEmail: 'raj@example.com',     parentPhone: '(312) 555-0106', program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 55, churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8',   mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024', cardLast4: '1234', cardBrand: 'Visa',       cardExpMonth: 8,  cardExpYear: 2027 },
  { id: 'd07', kidId: 'k07', name: 'Logan Scott',      age: '9U',  parent: 'James Scott',        parentEmail: 'james@example.com',   parentPhone: null,             program: '4-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 78, churnRisk: 'low',    lastSession: '4d ago',  nextCharge: '—',        mrr: 0,   lifetime: 720,  joinedDate: 'Mar 2025', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd08', kidId: 'k08', name: 'Aiden Torres',     age: '12U', parent: 'Maria Torres',       parentEmail: 'maria@example.com',   parentPhone: '(312) 555-0108', program: 'Team Training',        planType: 'eft', status: 'active',    engagementScore: 88, churnRisk: 'low',    lastSession: '1d ago',  nextCharge: 'Jun 2',   mrr: 450, lifetime: 4050, joinedDate: 'Apr 2024', cardLast4: '9876', cardBrand: 'Amex',       cardExpMonth: 3,  cardExpYear: 2030 },
  { id: 'd09', kidId: 'k09', name: 'Caleb Nguyen',     age: '13U', parent: 'Linh Nguyen',        parentEmail: 'linh@example.com',    parentPhone: '(312) 555-0109', program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 95, churnRisk: 'low',    lastSession: 'Today',   nextCharge: 'Jun 10',  mrr: 280, lifetime: 5040, joinedDate: 'Nov 2023', cardLast4: '3333', cardBrand: 'Visa',       cardExpMonth: 11, cardExpYear: 2026 },
  { id: 'd10', kidId: 'k10', name: 'Jaxon Rivera',     age: '10U', parent: 'Sofia Rivera',       parentEmail: 'sofia@example.com',   parentPhone: '(312) 555-0110', program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 70, churnRisk: 'low',    lastSession: '7d ago',  nextCharge: 'Jun 6',   mrr: 120, lifetime: 1080, joinedDate: 'Aug 2024', cardLast4: '7777', cardBrand: 'Mastercard', cardExpMonth: 1,  cardExpYear: 2028 },
  { id: 'd11', kidId: 'k11', name: 'Owen Murphy',      age: '15U', parent: 'Patrick Murphy',     parentEmail: 'patrick@example.com', parentPhone: '(312) 555-0111', program: 'Team Training',        planType: 'eft', status: 'paused',    engagementScore: 30, churnRisk: 'high',   lastSession: '35d ago', nextCharge: '—',        mrr: 0,   lifetime: 2250, joinedDate: 'May 2024', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd12', kidId: 'k12', name: 'Liam Perez',       age: '11U', parent: 'Ana Perez',          parentEmail: 'ana@example.com',     parentPhone: null,             program: '8-Pack Lessons',       planType: 'otc', status: 'active',    engagementScore: 82, churnRisk: 'low',    lastSession: '3d ago',  nextCharge: '—',        mrr: 0,   lifetime: 960,  joinedDate: 'Jan 2025', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd13', kidId: 'k13', name: 'Zane Harris',      age: '14U', parent: 'Terry Harris',       parentEmail: 'terry@example.com',   parentPhone: '(312) 555-0113', program: 'Unlimited Monthly',   planType: 'eft', status: 'active',    engagementScore: 77, churnRisk: 'low',    lastSession: '6d ago',  nextCharge: 'Jun 12',  mrr: 280, lifetime: 3360, joinedDate: 'Feb 2024', cardLast4: '2222', cardBrand: 'Visa',       cardExpMonth: 7,  cardExpYear: new Date().getFullYear() },
  { id: 'd14', kidId: 'k14', name: 'Carter Simmons',   age: '12U', parent: 'Gina Simmons',       parentEmail: 'gina@example.com',    parentPhone: null,             program: '4-Pack Lessons',       planType: 'otc', status: 'cancelled', engagementScore: 0,  churnRisk: 'high',   lastSession: '52d ago', nextCharge: '—',        mrr: 0,   lifetime: 540,  joinedDate: 'Oct 2024', cardLast4: null,   cardBrand: null,         cardExpMonth: null, cardExpYear: null },
  { id: 'd15', kidId: 'k15', name: 'Hunter Davis',     age: '13U', parent: 'Todd Davis',         parentEmail: 'todd@example.com',    parentPhone: '(312) 555-0115', program: 'Cage Rental Monthly',  planType: 'eft', status: 'active',    engagementScore: 68, churnRisk: 'low',    lastSession: '9d ago',  nextCharge: 'Jun 4',   mrr: 120, lifetime: 1320, joinedDate: 'Sep 2024', cardLast4: '6868', cardBrand: 'Discover',   cardExpMonth: 9,  cardExpYear: 2027 },
];

// ── Payment cell renderer ───────────────────────────────────────────────────

function PaymentCell({ member }: { member: OwnerMember }) {
  const { cardLast4, cardBrand, cardExpMonth, cardExpYear, planType } = member;

  if (planType === 'otc') {
    return <span style={{ fontSize: 11, color: brand.textMuted }}>OTC — no autopay</span>;
  }

  if (!cardLast4) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <CreditCard size={13} color={brand.danger} />
        <span style={{ fontSize: 11, color: brand.danger, fontWeight: 600 }}>No card on file</span>
      </div>
    );
  }

  const expiring = isCardExpiringSoon(cardExpMonth, cardExpYear);
  const expired  = isCardExpired(cardExpMonth, cardExpYear);
  const expLabel = cardExpMonth && cardExpYear
    ? `${String(cardExpMonth).padStart(2, '0')}/${String(cardExpYear).slice(-2)}`
    : '';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
        <CreditCard size={12} color={brand.textMuted} />
        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: fonts.mono }}>
          {cardBrand} ····{cardLast4}
        </span>
      </div>
      {expired ? (
        <Chip color="danger">Expired {expLabel}</Chip>
      ) : expiring ? (
        <Chip color="warning">Expiring Soon {expLabel}</Chip>
      ) : (
        <span style={{ fontSize: 10, color: brand.textMuted }}>Exp {expLabel}</span>
      )}
    </div>
  );
}

// ── Table columns ──────────────────────────────────────────────────────────

const columns: TableColumn<OwnerMember & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'name', sortable: true,
    render: (r) => {
      const phone = r.parentPhone as string | null;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display, flexShrink: 0 }}>
            {(r.name as string).charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}><PlayerLink name={r.name} reference={{ kidId: r.kidId, membershipId: r.id }} /></div>
            <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age as string} · {r.parent as string}</div>
            {phone && (
              <a
                href={`tel:${phone}`}
                onClick={e => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: brand.gold, textDecoration: 'none', marginTop: 2 }}
              >
                <Phone size={10} />
                {phone}
              </a>
            )}
          </div>
        </div>
      );
    },
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
        : rawStatus === 'at-risk' ? 'At Risk'
        : rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
      const color = (rawStatus === 'active' || rawStatus === 'at-risk') ? 'success'
        : rawStatus === 'paused' ? 'warning'
        : 'danger';
      const m = r as unknown as OwnerMember;
      const resumeDate = rawStatus === 'paused' && m.pauseEnd ? m.pauseEnd.slice(0, 10) : null;
      const hasPendingCancel = !!(m.cancelRequestedAt) && rawStatus !== 'cancelled';
      return (
        <div>
          <Chip color={color}>{label}</Chip>
          {resumeDate && (
            <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 3 }}>
              Resumes {resumeDate}
            </div>
          )}
          {hasPendingCancel && (
            <div style={{ fontSize: 10, color: '#FFC107', marginTop: 3, fontWeight: 600 }}>
              Cancel pending
            </div>
          )}
        </div>
      );
    },
  },
  {
    label: 'Payment Method', key: 'cardLast4',
    render: (r) => <PaymentCell member={r as unknown as OwnerMember} />,
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
  const source = members;
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'pending-cancel' | 'at-risk' | 'card-expiring'>('all');
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
    if (filter === 'active')         return m.status === 'active' || m.status === 'at-risk';
    if (filter === 'paused')         return m.status === 'paused';
    if (filter === 'pending-cancel') return !!(m as OwnerMember).cancelRequestedAt && m.status !== 'cancelled';
    if (filter === 'at-risk')        return m.churnRisk === 'high' || m.churnRisk === 'medium';
    if (filter === 'card-expiring') {
      return (
        isCardExpiringSoon(m.cardExpMonth, m.cardExpYear) ||
        isCardExpired(m.cardExpMonth, m.cardExpYear) ||
        (m.planType === 'eft' && !m.cardLast4)
      );
    }
    return true;
  });

  const cardExpiringSoonCount = source.filter(m =>
    isCardExpiringSoon(m.cardExpMonth, m.cardExpYear) ||
    isCardExpired(m.cardExpMonth, m.cardExpYear) ||
    (m.planType === 'eft' && !m.cardLast4)
  ).length;

  const pausedCount         = source.filter(m => m.status === 'paused').length;
  const pendingCancelCount  = source.filter(m => !!(m as OwnerMember).cancelRequestedAt && m.status !== 'cancelled').length;

  const tabs = [
    { id: 'all',             label: 'All',                count: source.length },
    { id: 'active',          label: 'Active',             count: source.filter(m => m.status === 'active' || m.status === 'at-risk').length },
    { id: 'paused',          label: 'Paused',             count: pausedCount },
    { id: 'pending-cancel',  label: 'Pending Cancel',     count: pendingCancelCount },
    { id: 'at-risk',         label: 'At Risk',            count: source.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium').length },
    { id: 'card-expiring',   label: 'Card Expiring Soon', count: cardExpiringSoonCount },
  ];

  const handleExport = () => {
    exportCsv(`members-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered as unknown as Record<string, unknown>[],
      [
        { label: 'Name',         key: 'name' },
        { label: 'Age',          key: 'age' },
        { label: 'Parent',       key: 'parent' },
        { label: 'Parent Phone', key: 'parentPhone' },
        { label: 'Parent Email', key: 'parentEmail' },
        { label: 'Program',      key: 'program' },
        { label: 'Plan',         key: 'planType' },
        { label: 'Status',       key: 'status' },
        { label: 'Card Brand',   key: 'cardBrand' },
        { label: 'Card Last4',   key: 'cardLast4' },
        { label: 'Card Exp',     key: 'cardExpMonth' },
        { label: 'Engagement',   key: 'engagementScore' },
        { label: 'Last Session', key: 'lastSession' },
        { label: 'Next Charge',  key: 'nextCharge' },
        { label: 'MRR',          key: 'mrr' },
        { label: 'Lifetime',     key: 'lifetime' },
        { label: 'Joined',       key: 'joinedDate' },
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
            <OButton variant="secondary" icon={Plus} onClick={() => setShowAddModal(true)}>Invite Member</OButton>
            <OButton variant="gold" icon={UserPlus} onClick={() => router.push('/owner/enroll')}>Enroll New Member</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div className="portal-sticky-controls owner-member-controls" aria-label="Member filters" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {tabs.map(f => {
            const isCardTab = f.id === 'card-expiring';
            const isActive = filter === f.id;
            return (
              <button type="button" aria-pressed={isActive}
                key={f.id}
                onClick={() => setFilter(f.id as typeof filter)}
                style={{
                  padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: isActive ? brand.dark : brand.surface,
                  color: isActive ? brand.gold : (isCardTab || f.id === 'pending-cancel') && f.count > 0 ? '#FFC107' : brand.textMuted,
                  border: `1px solid ${isActive ? brand.dark : (isCardTab || f.id === 'pending-cancel') && f.count > 0 ? 'rgba(255,193,7,0.4)' : brand.border}`,
                  cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {isCardTab && f.count > 0 && !isActive && <AlertTriangle size={11} color="#FFC107" />}
                {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.count}</span>
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <details style={{ fontSize: 12, padding: 8 }}>
            <summary>About member filters</summary>
            <p>Choose a status, engagement risk or payment-card category above. Counts reflect the recorded memberships in this location’s tenant.</p>
          </details>
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
            style={{ width: 'min(480px, calc(100vw - 32px))', maxHeight: '90dvh', overflowY: 'auto', background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
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
                    {['8U','10U','12U','14U','HS','College'].map(a => <option key={a}>{a}</option>)}
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
