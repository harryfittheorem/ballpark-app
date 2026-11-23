'use client';
import Link from 'next/link';

import { useState, useEffect } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Clock, AlertTriangle, CheckCircle2, Download, Mail, Phone, Loader2, AlertCircle } from 'lucide-react';
import type { ExpiringPack } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = { packs: ExpiringPack[] };

function urgencyColor(daysUntilExpiry: number): string {
  if (daysUntilExpiry <= 7)  return brand.danger;
  if (daysUntilExpiry <= 30) return brand.warning;
  return brand.success;
}

function urgencyLabel(daysUntilExpiry: number): { color: 'danger' | 'warning' | 'success'; text: string } {
  if (daysUntilExpiry <= 7)  return { color: 'danger',  text: `${daysUntilExpiry}d` };
  if (daysUntilExpiry <= 30) return { color: 'warning', text: `${daysUntilExpiry}d` };
  return { color: 'success', text: `${daysUntilExpiry}d` };
}

function makeColumns(
  onReminder: (pack: ExpiringPack) => void,
  loadingIds: Set<string>,
  showRiskFlag: boolean,
): TableColumn<ExpiringPack & Record<string, unknown>>[] {
  const cols: TableColumn<ExpiringPack & Record<string, unknown>>[] = [
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
      render: (r) => <span style={{ fontSize: 12, fontWeight: 600 }}>{r.planName as string}</span>,
    },
    {
      label: 'Sessions Left', key: 'sessionsRemaining', align: 'right',
      render: (r) => {
        const v = r.sessionsRemaining as number | null;
        if (v == null) return <span style={{ color: brand.textMuted }}>—</span>;
        return (
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono, color: v <= 2 ? brand.danger : v <= 5 ? brand.warning : brand.text }}>
            {v}
          </span>
        );
      },
    },
    {
      label: 'Expires', key: 'expiresAtLabel', sortable: true,
      render: (r) => {
        const days = r.daysUntilExpiry as number;
        const label = r.expiresAtLabel as string;
        const color = urgencyColor(days);
        return (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>{label}</div>
            <Chip color={urgencyLabel(days).color} size="sm">{urgencyLabel(days).text} {days >= 0 ? 'left' : 'ago'}</Chip>
          </div>
        );
      },
    },
  ];

  if (showRiskFlag) {
    cols.push({
      label: 'Risk Flag', key: 'hasUnusedSessions',
      render: (r) => {
        const hasUnused = r.hasUnusedSessions as boolean;
        if (!hasUnused) return <span style={{ fontSize: 11, color: brand.textMuted }}>—</span>;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: brand.warning }}>
            <AlertCircle size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Loyalty Risk</span>
          </div>
        );
      },
    });
  }

  cols.push({
    label: 'Actions', key: 'id',
    render: (r) => {
      const pack = r as unknown as ExpiringPack;
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
  });

  return cols;
}

export function ExpiringPacksContent({ packs: raw }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const expiringSoon    = raw.filter(p => !p.isExpired);
  const recentlyExpired = raw.filter(p => p.isExpired);

  const critical = expiringSoon.filter(p => p.daysUntilExpiry <= 7).length;
  const soon     = expiringSoon.filter(p => p.daysUntilExpiry > 7 && p.daysUntilExpiry <= 30).length;
  const upcoming = expiringSoon.filter(p => p.daysUntilExpiry > 30).length;

  async function sendReminder(pack: ExpiringPack) {
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
          expiresAtLabel: pack.expiresAtLabel,
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
    exportCsv(`expiring-packs-${new Date().toISOString().slice(0, 10)}.csv`,
      raw as unknown as Record<string, unknown>[],
      [
        { label: 'Kid Name',          key: 'kidName' },
        { label: 'Parent',            key: 'parentName' },
        { label: 'Parent Email',      key: 'parentEmail' },
        { label: 'Plan',              key: 'planName' },
        { label: 'Sessions Remaining',key: 'sessionsRemaining' },
        { label: 'Expires',           key: 'expiresAtLabel' },
        { label: 'Days Until Expiry', key: 'daysUntilExpiry' },
        { label: 'Loyalty Risk',      key: 'hasUnusedSessions' },
      ],
    );
    setToast(`Exported ${raw.length} packs as CSV`);
  };

  const upcomingColumns  = makeColumns(sendReminder, loadingIds, false);
  const expiredColumns   = makeColumns(sendReminder, loadingIds, true);

  return (
    <div>
      <PageHeader
        title="Expiring Packs"
        subtitle="OTC lesson packs expiring in the next 60 days, plus recently expired"
        actions={<OButton variant="secondary" icon={Download} onClick={handleExport}>Export CSV</OButton>}
      />

      <div style={{ padding: 24 }}>
        {/* Definition banner */}
        <div style={{ background: `${brand.info}12`, border: `1px solid ${brand.info}33`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
          <strong style={{ color: brand.text }}>Expiring Packs</strong> — OTC (upfront cash) session packs with an expiry date approaching or passed.
          Trigger is the pack's calendar expiry date, regardless of sessions remaining.
          {' '}<em>Compare with <strong style={{ color: brand.text }}>Low Balance Packs</strong>, which are filtered by sessions remaining (≤ 2 sessions left), not by expiry date.</em>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Critical (0–7 days)"   value={critical} icon={AlertTriangle} color={critical > 0 ? 'danger' : 'default'} />
          <KPICard label="Soon (8–30 days)"       value={soon}     icon={Clock}         color={soon > 0 ? 'warning' : 'default'} />
          <KPICard label="Upcoming (31–60 days)"  value={upcoming} icon={Clock}         color={upcoming > 0 ? 'success' : 'default'} />
        </div>

        {expiringSoon.length > 0 ? (
          <>
            <SectionHeader
              title="Expiring Soon"
              subtitle="Packs expiring in the next 60 days — sorted by expiry date"
            />
            <div style={{ marginBottom: 32 }}>
              <OTable
                columns={upcomingColumns as TableColumn<Record<string, unknown>>[]}
                rows={expiringSoon as unknown as Record<string, unknown>[]}
              />
            </div>
          </>
        ) : (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 32, textAlign: 'center', marginBottom: 32 }}>
            <CheckCircle2 size={36} color={brand.success} style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display }}>No packs expiring in the next 60 days</div>
          </div>
        )}

        {recentlyExpired.length > 0 && (
          <>
            <SectionHeader
              title="Recently Expired"
              subtitle="Expired in the last 30 days · Loyalty Risk flag = unused sessions forfeited"
            />
            <OTable
              columns={expiredColumns as TableColumn<Record<string, unknown>>[]}
              rows={recentlyExpired as unknown as Record<string, unknown>[]}
            />
          </>
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
