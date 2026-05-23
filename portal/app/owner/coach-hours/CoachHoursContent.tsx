'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { Download, Clock } from 'lucide-react';
import type { CoachHoursRow } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type Props = {
  rows: CoachHoursRow[];
  startDate: string;
  endDate: string;
  defaultStart: string;
  defaultEnd: string;
};

function monthLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function CoachHoursContent({ rows, startDate, endDate, defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [toast, setToast] = useState<string | null>(null);

  const isDefaultRange = start === defaultStart && end === defaultEnd;
  const heading = isDefaultRange
    ? monthLabel(defaultStart)
    : `${start} – ${end}`;

  function applyFilter() {
    startTransition(() => {
      router.push(`/owner/coach-hours?start=${start}&end=${end}`);
    });
  }

  function handleExport() {
    if (rows.length === 0) return;
    exportCsv(
      `coach-hours-${start}-to-${end}.csv`,
      rows as unknown as Record<string, unknown>[],
      [
        { label: 'Coach Name',  key: 'coach_name'      },
        { label: 'Confirmed',   key: 'confirmed_count'  },
        { label: 'Completed',   key: 'completed_count'  },
        { label: 'No-Shows',    key: 'no_show_count'    },
        { label: 'Cancelled',   key: 'cancelled_count'  },
        { label: 'Total Hours', key: 'total_hours'      },
      ],
    );
    setToast(`Exported ${rows.length} coach${rows.length !== 1 ? 'es' : ''} as CSV`);
    setTimeout(() => setToast(null), 3500);
  }

  const totalHours     = rows.reduce((s, r) => s + r.total_hours, 0);
  const totalCompleted = rows.reduce((s, r) => s + r.completed_count, 0);

  return (
    <div>
      <PageHeader
        title="Coach Hours Report"
        subtitle={`Sessions and logged hours by coach — ${heading}`}
        actions={
          <OButton variant="secondary" icon={Download} onClick={handleExport} disabled={rows.length === 0}>
            Export CSV
          </OButton>
        }
      />

      <div style={{ padding: 24 }}>

        {/* ── Date range filter ── */}
        <OCard style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: brand.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Date Range
            </div>
            <input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              style={inputStyle}
            />
            <span style={{ fontSize: 12, color: brand.textMuted }}>to</span>
            <input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              style={inputStyle}
            />
            <OButton variant="gold" size="sm" onClick={applyFilter}>Apply</OButton>
          </div>
        </OCard>

        {/* ── Summary KPIs ── */}
        {rows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            <SummaryCard label="Total Coaches" value={String(rows.length)} />
            <SummaryCard label="Completed Sessions" value={String(totalCompleted)} />
            <SummaryCard label="Total Hours" value={`${totalHours.toFixed(2)} hrs`} />
          </div>
        )}

        {/* ── Table ── */}
        <SectionHeader title="Hours by Coach" />

        {rows.length === 0 ? (
          <OCard>
            <div style={{ textAlign: 'center', padding: '40px 0', color: brand.textMuted }}>
              <Clock size={32} color={brand.border} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No sessions in this period</div>
              <div style={{ fontSize: 12 }}>Try a different date range where bookings exist.</div>
            </div>
          </OCard>
        ) : (
          <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                  {[
                    { label: 'Coach Name',  align: 'left'  },
                    { label: 'Confirmed',   align: 'right' },
                    { label: 'Completed',   align: 'right' },
                    { label: 'No-Shows',    align: 'right' },
                    { label: 'Cancelled',   align: 'right' },
                    { label: 'Total Hours', align: 'right' },
                  ].map((h, i) => (
                    <th key={i} style={{
                      padding: '12px 16px',
                      textAlign: h.align as 'left' | 'right',
                      fontSize: 10, fontWeight: 800, color: brand.textMuted,
                      letterSpacing: 1, textTransform: 'uppercase',
                      fontFamily: fonts.display, whiteSpace: 'nowrap',
                    }}>
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.coach_id}
                    style={{ borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none' }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700, color: brand.text }}>
                      {row.coach_name}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: fonts.mono, color: brand.text }}>
                      {row.confirmed_count}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.success }}>
                      {row.completed_count}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: fonts.mono, color: row.no_show_count > 0 ? brand.warning : brand.textMuted }}>
                      {row.no_show_count}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: fonts.mono, color: brand.textMuted }}>
                      {row.cancelled_count}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 13, fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>
                      {row.total_hours.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: `1px solid ${brand.border}`,
  background: brand.surface,
  fontSize: 13,
  color: brand.text,
  fontFamily: fonts.mono,
};

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}
