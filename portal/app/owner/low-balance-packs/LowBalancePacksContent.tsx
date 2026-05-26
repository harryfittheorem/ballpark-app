'use client';

import { useState, useEffect } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, OTable } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Battery, Mail, Phone, Loader2, Download, Users } from 'lucide-react';
import type { LowBalancePack } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = { packs: LowBalancePack[] };

function SessionPill({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const color = pct <= 15 ? brand.danger : pct <= 30 ? brand.warning : brand.goldDeep;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 72, height: 7, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, minWidth: 2 }} />
      </div>
      <span style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: 700, color }}>
        {remaining} / {total}
      </span>
    </div>
  );
}

function makeColumns(onReminder: (pack: LowBalancePack) => void, loadingIds: Set<string>): TableColumn<LowBalancePack & Record<string, unknown>>[] {
  return [
    {
      label: 'Member', key: 'kidName',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display, border: `1px solid ${brand.border}` }}>
            {(r.kidName as string).charAt(0)}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{r.kidName as string}</div>
            <div style={{ fontSize: 11, color: brand.textMuted }}>{r.parentName as string}</div>
          </div>
        </div>
      ),
    },
    {
      label: 'Plan', key: 'planName',
      render: (r) => <span style={{ fontSize: 12, fontWeight: 600 }}>{r.planName as string}</span>,
    },
    {
      label: 'Sessions Remaining', key: 'sessionsRemaining', sortable: true,
      render: (r) => (
        <SessionPill
          remaining={r.sessionsRemaining as number}
          total={r.sessionsTotal as number}
        />
      ),
    },
    {
      label: 'Last Session', key: 'lastSessionLabel',
      render: (r) => <span style={{ fontSize: 12, color: brand.textMuted }}>{r.lastSessionLabel as string}</span>,
    },
    {
      label: 'Actions', key: 'id',
      render: (r) => {
        const pack = r as unknown as LowBalancePack;
        const isLoading = loadingIds.has(pack.id);
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <OButton
              variant="gold" size="sm"
              icon={isLoading ? Loader2 : Mail}
              onClick={() => onReminder(pack)}
              disabled={isLoading}
            >
              {isLoading ? 'Sending…' : 'Send Reminder'}
            </OButton>
            {pack.parentPhone && (
              <OButton variant="secondary" size="sm" icon={Phone}>Call</OButton>
            )}
          </div>
        );
      },
    },
  ];
}

export function LowBalancePacksContent({ packs: raw }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const totalSessionsLeft = raw.reduce((s, p) => s + p.sessionsRemaining, 0);

  async function sendReminder(pack: LowBalancePack) {
    setLoadingIds(prev => new Set(prev).add(pack.id));
    try {
      const res = await fetch('/api/owner/send-renewal-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: pack.parentName,
          parentEmail: pack.parentEmail,
          kidName: pack.kidName,
          planName: pack.planName,
          sessionsRemaining: pack.sessionsRemaining,
          expiresAtLabel: null,
        }),
      });
      const data = await res.json() as { success?: boolean; skipped?: boolean; error?: string };
      if (!res.ok || data.error) {
        setToast(`Failed to send: ${data.error ?? 'Unknown error'}`);
      } else if (data.skipped) {
        setToast(`Reminder queued for ${pack.parentName} — email not yet configured`);
      } else {
        setToast(`Renewal reminder sent to ${pack.parentName} (${pack.parentEmail})`);
      }
    } catch {
      setToast('Network error — email not sent');
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(pack.id); return s; });
    }
  }

  const handleExport = () => {
    exportCsv(`low-balance-packs-${new Date().toISOString().slice(0, 10)}.csv`,
      raw as unknown as Record<string, unknown>[],
      [
        { label: 'Kid Name',           key: 'kidName' },
        { label: 'Parent',             key: 'parentName' },
        { label: 'Parent Email',       key: 'parentEmail' },
        { label: 'Plan',               key: 'planName' },
        { label: 'Sessions Remaining', key: 'sessionsRemaining' },
        { label: 'Sessions Total',     key: 'sessionsTotal' },
        { label: 'Last Session',       key: 'lastSessionLabel' },
      ],
    );
    setToast(`Exported ${raw.length} packs as CSV`);
  };

  const columns = makeColumns(sendReminder, loadingIds);

  return (
    <div>
      <PageHeader
        title="Low Balance Packs"
        subtitle="OTC memberships running low on sessions — renewal opportunities"
        actions={<OButton variant="secondary" icon={Download} onClick={handleExport}>Export CSV</OButton>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard
            label="Low Balance Packs"
            value={raw.length}
            icon={Battery}
            color={raw.length > 0 ? 'warning' : 'default'}
          />
          <KPICard
            label="Sessions Remaining (total)"
            value={totalSessionsLeft}
            icon={Users}
            color="default"
          />
        </div>

        {raw.length === 0 ? (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 48, textAlign: 'center', color: brand.textMuted }}>
            No packs running low right now.
          </div>
        ) : (
          <OTable
            columns={columns as TableColumn<Record<string, unknown>>[]}
            rows={raw as unknown as Record<string, unknown>[]}
          />
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 400 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
