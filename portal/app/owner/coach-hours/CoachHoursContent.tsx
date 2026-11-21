'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard } from '@/components/owner/ui';
import { Download, Clock, AlertCircle, X, Star } from 'lucide-react';
import type { CoachHoursRow } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';

type CoachLessonDetail = {
  id: string;
  kid_name: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_coach_name: string | null;
  type_name: string;
  status: string;
  rating: number | null;
};
type HoursRow = CoachHoursRow & {
  no_show_count: number;
  completed_count: number;
  cancelled_count: number;
  total_hours: number;
  avg_rating: number | null;
  rated_count: number;
  eligible_count: number;
  original_hire_date: string | null;
  first_anniversary: string | null;
  lessons: CoachLessonDetail[];
};
type Props = { rows: CoachHoursRow[] | null; startDate: string; endDate: string; defaultStart: string; defaultEnd: string };

const statusLabel: Record<string, string> = { completed: 'Done', no_show: 'No-show', cancelled: 'Cancelled' };
const displayDate = (value: string | null) => {
  if (!value) return 'Not recorded';
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};
const displayTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function CoachHoursContent({ rows, startDate, endDate, defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);
  const [toast, setToast] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [drill, setDrill] = useState<{ row: HoursRow; status: 'completed' | 'no_show' | 'cancelled' } | null>(null);
  const safeRows = (rows ?? []) as unknown as HoursRow[];
  const isDefaultRange = start === defaultStart && end === defaultEnd;
  const heading = isDefaultRange ? 'Last 12 months' : `${start} – ${end}`;
  function applyFilter() {
    if (end < start) { setDateError('End date must be on or after the start date.'); return; }
    setDateError(null);
    startTransition(() => router.push(`/owner/coach-hours?start=${start}&end=${end}`));
  }
  function handleExport() {
    if (!rows?.length) return;
    exportCsv(`coach-hours-${start}-to-${end}.csv`, safeRows.map(row => ({
      coach_name: row.coach_name, completed_count: row.completed_count, no_show_count: row.no_show_count,
      cancelled_count: row.cancelled_count, total_hours: row.total_hours, avg_rating: row.avg_rating,
      rated_count: row.rated_count, eligible_count: row.eligible_count,
      original_hire_date: row.original_hire_date, first_anniversary: row.first_anniversary,
    })), [
      { label: 'Coach Name', key: 'coach_name' }, { label: 'Sessions Done', key: 'completed_count' },
      { label: 'No-Shows', key: 'no_show_count' }, { label: 'Cancelled', key: 'cancelled_count' },
      { label: 'Total Hours', key: 'total_hours' }, { label: 'Average Rating', key: 'avg_rating' },
      { label: 'Rated', key: 'rated_count' }, { label: 'Eligible', key: 'eligible_count' },
      { label: 'Original Hire Date', key: 'original_hire_date' }, { label: 'First Anniversary', key: 'first_anniversary' },
    ]);
    setToast(`Exported ${safeRows.length} coach${safeRows.length !== 1 ? 'es' : ''} as CSV`);
    setTimeout(() => setToast(null), 3500);
  }
  const totalHours = safeRows.reduce((sum, row) => sum + (row.total_hours ?? 0), 0);
  const totalCompleted = safeRows.reduce((sum, row) => sum + (row.completed_count ?? 0), 0);
  const shownLessons = drill?.row.lessons?.filter(lesson => lesson.status === drill.status) ?? [];

  return <div>
    <PageHeader title="Coach Hours Report" subtitle={`Sessions and logged hours by coach — ${heading}`} actions={<OButton variant="secondary" icon={Download} onClick={handleExport} disabled={!rows?.length}>Export CSV</OButton>} />
    <div style={{ padding: 24 }}>
      <OCard style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: brand.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Date Range</div>
          <input aria-label="Start date" type="date" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
          <span style={{ fontSize: 12, color: brand.textMuted }}>to</span>
          <input aria-label="End date" type="date" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
          <OButton variant="gold" size="sm" onClick={applyFilter}>Apply</OButton>
        </div>
        {dateError && <div role="alert" style={{ marginTop: 8, fontSize: 12, color: brand.warning, fontWeight: 600 }}>{dateError}</div>}
      </OCard>
      {rows === null && <OCard style={{ marginBottom: 24, borderColor: brand.warning }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, color: brand.warning }}><AlertCircle size={20} /><div><div style={{ fontSize: 13, fontWeight: 700 }}>Coach Hours data unavailable</div><div style={{ fontSize: 12, color: brand.textMuted }}>The report data could not be loaded. Try refreshing the page later.</div></div></div></OCard>}
      {safeRows.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}><SummaryCard label="Total Coaches" value={String(safeRows.length)} /><SummaryCard label="Sessions Done" value={String(totalCompleted)} /><SummaryCard label="Total Hours" value={`${totalHours.toFixed(2)} hrs`} /></div>}
      <SectionHeader title="Hours by Coach" />
      {safeRows.length === 0 ? <OCard><div style={{ textAlign: 'center', padding: '40px 0', color: brand.textMuted }}><Clock size={32} color={brand.border} style={{ marginBottom: 12 }} /><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{rows === null ? 'Report unavailable' : 'No sessions in this period'}</div><div style={{ fontSize: 12 }}>{rows === null ? 'Coach-hour details are not available right now.' : 'Try a different date range where bookings exist.'}</div></div></OCard> : <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>{[
            ['Coach', 'left'], ['Sessions Done', 'right'], ['No-Shows / Cancelled', 'right'], ['Hours', 'right'], ['Avg rating', 'right'], ['Hire date', 'left'], ['First anniversary', 'left'],
          ].map(([label, align]) => <th key={label} style={{ padding: '12px 14px', textAlign: align as 'left' | 'right', fontSize: 10, fontWeight: 800, color: brand.textMuted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap' }}>{label}</th>)}</tr></thead>
          <tbody>{safeRows.map((row, index) => <tr key={row.coach_id} style={{ borderBottom: index < safeRows.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
            <td style={cellStyle}>{row.coach_name}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}><button onClick={() => setDrill({ row, status: 'completed' })} style={countButton}>{row.completed_count}</button></td>
            <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}><button onClick={() => setDrill({ row, status: 'no_show' })} style={countButton}>{row.no_show_count}</button><span style={{ color: brand.textMuted }}> / </span><button onClick={() => setDrill({ row, status: 'cancelled' })} style={countButton}>{row.cancelled_count}</button></td>
            <td style={{ ...cellStyle, textAlign: 'right', fontFamily: fonts.mono }}>{Number(row.total_hours ?? 0).toFixed(2)}</td>
            <td style={{ ...cellStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{row.avg_rating == null ? <><span style={{ color: brand.textMuted }}>Not rated</span> <span style={{ color: brand.textMuted, fontSize: 11 }}>· {row.rated_count}/{row.eligible_count} rated</span></> : <><Star size={12} color={brand.goldDeep} fill={brand.goldDeep} style={{ verticalAlign: 'middle' }} /> <strong>{row.avg_rating.toFixed(1)}</strong> <span style={{ color: brand.textMuted, fontSize: 11 }}>· {row.rated_count}/{row.eligible_count} rated</span></>}</td>
            <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{displayDate(row.original_hire_date)}</td><td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{displayDate(row.first_anniversary)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
    {drill && <div role="dialog" aria-modal="true" aria-labelledby="drill-title" onClick={() => setDrill(null)} style={overlayStyle}>
      <div onClick={e => e.stopPropagation()} style={dialogStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${brand.border}`, padding: '18px 20px' }}>
          <div><div id="drill-title" style={{ fontSize: 17, fontFamily: fonts.display, fontWeight: 800, color: brand.text }}>{statusLabel[drill.status]} sessions · {drill.row.coach_name}</div><div style={{ color: brand.textMuted, fontSize: 12, marginTop: 4 }}>{shownLessons.length} matching session{shownLessons.length !== 1 ? 's' : ''} in the selected range</div></div>
          <button aria-label="Close session details" onClick={() => setDrill(null)} style={closeButton}><X size={17} /></button>
        </div>
        <div style={{ padding: 20, maxHeight: '65vh', overflowY: 'auto' }}>
          {shownLessons.length ? shownLessons.map(lesson => <div key={lesson.id} style={{ padding: '14px 0', borderBottom: `1px solid ${brand.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><strong style={{ color: brand.text }}>{lesson.kid_name || 'Athlete not recorded'}</strong><span style={{ color: brand.textMuted, fontSize: 12 }}>{displayTime(lesson.scheduled_start)}{lesson.scheduled_end ? ` – ${new Date(lesson.scheduled_end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
            <div style={{ color: brand.textMuted, fontSize: 12, marginTop: 6 }}>Actual instructor: {lesson.actual_coach_name || 'Not recorded'} · {lesson.type_name || 'Session type not recorded'}</div>
            <div style={{ color: lesson.rating == null ? brand.textMuted : brand.goldDeep, fontSize: 12, marginTop: 5 }}>Family rating: {lesson.rating == null ? 'Not rated' : `${lesson.rating}/5`}</div>
          </div>) : <div style={{ textAlign: 'center', color: brand.textMuted, padding: 28 }}>No session details for this status in the selected period.</div>}
        </div>
      </div>
    </div>}
    {toast && <div role="status" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600 }}>{toast}</div>}
  </div>;
}

const inputStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: `1px solid ${brand.border}`, background: brand.surface, fontSize: 13, color: brand.text, fontFamily: fonts.mono };
const cellStyle: React.CSSProperties = { padding: '14px 14px', fontSize: 13, fontWeight: 600, color: brand.text };
const countButton: React.CSSProperties = { border: 0, background: 'transparent', color: brand.goldDeep, fontFamily: fonts.mono, fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 5, minWidth: 34, textDecoration: 'underline', textUnderlineOffset: 3 };
const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(20,18,14,.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 };
const dialogStyle: React.CSSProperties = { width: 'min(760px, 100%)', background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, boxShadow: '0 18px 56px rgba(0,0,0,.25)', overflow: 'hidden' };
const closeButton: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${brand.border}`, background: brand.surfaceAlt, color: brand.text, display: 'grid', placeItems: 'center', cursor: 'pointer' };
function SummaryCard({ label, value }: { label: string; value: string }) { return <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 18 }}><div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 8 }}>{label}</div><div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: brand.text }}>{value}</div></div>; }
