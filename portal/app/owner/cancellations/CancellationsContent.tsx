'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { XCircle, DollarSign, Package, Download, Phone, Mail, MessageSquare } from 'lucide-react';
import type { CancelledMembership, CancellationReason } from '@/lib/supabase/ownerQueries';
import { CANCELLATION_REASONS } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';
import Link from 'next/link';

function ExitReasonCell({ membership }: { membership: CancelledMembership }) {
  const [reason, setReason] = useState<CancellationReason | null>(membership.cancellationReason);
  const [competitor, setCompetitor] = useState(membership.competitorName ?? '');
  const [saving, setSaving] = useState(false);

  async function save(newReason: CancellationReason | null, newCompetitor: string) {
    setSaving(true);
    await fetch('/api/owner/cancellation-reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ membershipId: membership.id, reason: newReason, competitorName: newCompetitor || null }),
    });
    setSaving(false);
  }

  async function handleReasonChange(value: string) {
    const newReason = value ? (value as CancellationReason) : null;
    setReason(newReason);
    if (newReason !== 'Competitor') setCompetitor('');
    await save(newReason, newReason === 'Competitor' ? competitor : '');
  }

  async function handleCompetitorBlur() {
    if (reason === 'Competitor') await save(reason, competitor);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <select
        value={reason ?? ''}
        onChange={e => void handleReasonChange(e.target.value)}
        disabled={saving}
        style={{
          padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600,
          border: `1px solid ${brand.border}`, background: brand.surface,
          color: reason ? brand.text : brand.textMuted, cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        <option value="">— Set reason</option>
        {CANCELLATION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      {reason === 'Competitor' && (
        <input
          type="text"
          placeholder="Competitor name…"
          value={competitor}
          maxLength={120}
          onChange={e => setCompetitor(e.target.value)}
          onBlur={() => void handleCompetitorBlur()}
          disabled={saving}
          style={{
            padding: '4px 8px', borderRadius: 5, fontSize: 11,
            border: `1px solid ${brand.border}`, background: brand.surface,
            color: brand.text, outline: 'none',
            opacity: saving ? 0.6 : 1,
          }}
        />
      )}
    </div>
  );
}

type Props = {
  memberships: CancelledMembership[];
  activePreset: string;
  sinceIso: string;
};

const columns: TableColumn<CancelledMembership & Record<string, unknown>>[] = [
  {
    label: 'Member', key: 'kidName',
    render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display, border: `1px solid ${brand.border}` }}>
          {(r.kidName as string).charAt(0)}
        </div>
        <div>
          <Link href={`/owner/members/${r.id}?section=package-history#package-history`} style={{ fontWeight: 700, textDecoration: 'underline' }}>{r.kidName as string}</Link>
          <div style={{ fontSize: 11, color: brand.textMuted }}>{r.parentName as string}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Plan', key: 'planName',
    render: (r) => (
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.planName as string}</div>
        <Chip color={(r.planType as string) === 'eft' ? 'info' : 'gold'} size="sm">{(r.planType as string).toUpperCase()}</Chip>
      </div>
    ),
  },
  {
    label: 'Cancelled', key: 'cancelledAtLabel', sortable: true,
    render: (r) => <span style={{ fontSize: 12 }}>{r.cancelledAtLabel as string}</span>,
  },
  {
    label: 'Sessions Unused', key: 'sessionsUnused', align: 'right',
    render: (r) => {
      const v = r.sessionsUnused as number | null;
      if ((r.planType as string) === 'eft') return <span style={{ fontSize: 11, color: brand.textMuted }}>—</span>;
      if (v == null) return <span style={{ fontSize: 11, color: brand.textMuted }}>—</span>;
      return (
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono, color: v > 0 ? brand.warning : brand.textMuted }}>
          {v}
        </span>
      );
    },
  },
  {
    label: 'MRR Impact', key: 'amountCents', sortable: true, align: 'right',
    render: (r) => {
      const planType = r.planType as string;
      const cents = r.amountCents as number;
      if (planType !== 'eft') return <span style={{ fontSize: 11, color: brand.textMuted }}>—</span>;
      return <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.danger }}>${(cents / 100).toLocaleString()}</span>;
    },
  },
  {
    label: 'Exit Reason', key: 'cancellationReason',
    render: (r) => <ExitReasonCell membership={r as unknown as CancelledMembership} />,
  },
  {
    label: 'Contact', key: 'id',
    render: (r) => {
      const phone = r.parentPhone as string | null;
      const email = r.parentEmail as string;
      return (
        <div style={{ display: 'flex', gap: 4 }}>
          {phone && (
            <a href={`tel:${phone}`} style={{ textDecoration: 'none' }}>
              <OButton variant="gold" size="sm" icon={Phone}>Call</OButton>
            </a>
          )}
          {phone && (
            <a href={`sms:${phone}`} style={{ textDecoration: 'none' }}>
              <OButton variant="secondary" size="sm" icon={MessageSquare}>Text</OButton>
            </a>
          )}
          <a href={`mailto:${email}`} style={{ textDecoration: 'none' }}>
            <OButton variant="secondary" size="sm" icon={Mail}>Email</OButton>
          </a>
        </div>
      );
    },
  },
];

export function CancellationsContent({ memberships: raw, activePreset, sinceIso }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [customDate, setCustomDate] = useState(sinceIso.slice(0, 10));

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const totalCancelled = raw.length;
  const lostMrr = raw
    .filter(m => m.planType === 'eft')
    .reduce((s, m) => s + m.amountCents, 0) / 100;
  const unusedSessions = raw
    .filter(m => m.planType === 'otc' && (m.sessionsUnused ?? 0) > 0)
    .reduce((s, m) => s + (m.sessionsUnused ?? 0), 0);

  const handlePreset = (preset: string) => {
    router.push(`/owner/cancellations?preset=${preset}`);
  };

  const handleCustomDate = () => {
    if (!customDate) return;
    router.push(`/owner/cancellations?since=${customDate}`);
  };

  const handleExport = () => {
    exportCsv(`cancellations-${new Date().toISOString().slice(0, 10)}.csv`,
      raw as unknown as Record<string, unknown>[],
      [
        { label: 'Kid Name',        key: 'kidName' },
        { label: 'Parent',          key: 'parentName' },
        { label: 'Parent Email',    key: 'parentEmail' },
        { label: 'Parent Phone',    key: 'parentPhone' },
        { label: 'Plan',            key: 'planName' },
        { label: 'Plan Type',       key: 'planType' },
        { label: 'Cancelled On',    key: 'cancelledAtLabel' },
        { label: 'Sessions Unused', key: 'sessionsUnused' },
        { label: 'Monthly Value',   key: 'amountCents' },
      ],
    );
    setToast(`Exported ${raw.length} cancellations as CSV`);
  };

  const presets = [
    { id: '30',  label: 'Last 30 Days' },
    { id: '90',  label: 'Last 90 Days' },
    { id: 'all', label: 'Last 12 Months' },
  ];

  return (
    <div>
      <PageHeader
        title="Cancellations"
        subtitle="Recent membership cancellations — filtered by cancellation date"
        actions={<OButton variant="secondary" icon={Download} onClick={handleExport}>Export CSV</OButton>}
      />

      <div style={{ padding: 24 }}>
        {/* KPI summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Total Cancelled"  value={totalCancelled}                            icon={XCircle}   color="danger" />
          <KPICard label="Lost MRR (EFT)"   value={`$${lostMrr.toLocaleString()}`}            icon={DollarSign} color="warning" />
          <KPICard label="Unused Sessions"  value={unusedSessions}                            icon={Package}   color={unusedSessions > 0 ? 'warning' : 'default'} />
        </div>

        {/* Date range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button type="button" aria-pressed={activePreset === p.id}
              key={p.id}
              onClick={() => handlePreset(p.id)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: activePreset === p.id ? brand.dark : brand.surface,
                color: activePreset === p.id ? brand.gold : brand.textMuted,
                border: `1px solid ${activePreset === p.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              }}
            >
              {p.label}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 600 }}>Custom:</span>
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              style={{
                padding: '6px 10px', border: `1px solid ${brand.border}`, borderRadius: 7,
                fontSize: 12, color: brand.text, background: brand.surface, outline: 'none',
              }}
            />
            <OButton variant="secondary" size="sm" onClick={handleCustomDate}>Apply</OButton>
          </div>
        </div>

        {raw.length === 0 ? (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 48, textAlign: 'center', color: brand.textMuted }}>
            No cancellations in this period.
          </div>
        ) : (
          <OTable
            columns={columns as TableColumn<Record<string, unknown>>[]}
            rows={raw as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
