'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDays, CircleHelp, Filter, Users } from 'lucide-react';
import { PageHeader } from '@/components/owner/ui';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { buildRetentionReport, DIVISIONS, lastCompletedMonth, shiftMonth } from '@/lib/retention/engine';
import type { RetentionDataset, RetentionFilters, RetentionReport, RetentionRow } from '@/lib/retention/types';
import { playerHref } from '@/lib/playerLinks';

type Mode = 'retention' | 'churn' | 'network';
type Props = { data: RetentionDataset; mode?: Mode };
type Period = 'month' | 'quarter' | 'year' | 'custom';
const panel: CSSProperties = { background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding: 18 };
const labelStyle: CSSProperties = { display: 'grid', gap: 6, color: brand.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display };
const controlStyle: CSSProperties = { width: '100%', minHeight: 42, borderRadius: 7, border: `1px solid ${brand.borderStrong}`, background: brand.surfaceAlt, color: brand.text, padding: '8px 10px', fontSize: 13, fontFamily: fonts.body };
const fmtMonth = (value: string) => {
  if (!/^\d{4}-\d{2}$/.test(value)) return value || 'Unavailable';
  return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T00:00:00Z`));
};
const count = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toLocaleString();
const rate = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)}%`;
const unique = (values: Array<string | null | undefined>) => [...new Set(values.filter((v): v is string => !!v && v.trim().length > 0))].sort((a, b) => a.localeCompare(b));

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label style={labelStyle}>{label}<select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={controlStyle}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
}

function Metric({ title, value, sub, accent }: { title: string; value: string; sub: string; accent?: string }) {
  return <div style={{ ...panel, minHeight: 126, borderTop: `2px solid ${accent ?? brand.goldDeep}` }}>
    <div style={{ color: brand.textMuted, fontFamily: fonts.display, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{title}</div>
    <div style={{ color: brand.text, fontFamily: fonts.display, fontSize: 30, lineHeight: 1.15, fontWeight: 700, marginTop: 15 }}>{value}</div>
    <div style={{ color: brand.textMuted, fontSize: 11, marginTop: 8 }}>{sub}</div>
  </div>;
}

function DataTable({ caption, headers, rows, empty }: { caption: string; headers: string[]; rows: ReactNode[][]; empty: string; }) {
  return <div role="region" aria-label={`${caption}. Scroll horizontally to view all columns.`} tabIndex={0} style={{ overflowX: 'auto', border: `1px solid ${brand.border}`, borderRadius: 9 }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520, fontSize: 12 }}>
      <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' }}>{caption}</caption>
      <thead><tr>{headers.map((h, i) => <th key={h} scope="col" style={{ textAlign: i ? 'right' : 'left', padding: '11px 13px', background: brand.surfaceAlt, color: brand.textMuted, borderBottom: `1px solid ${brand.border}`, fontFamily: fonts.display, letterSpacing: 0.8, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
      {rows.length ? <tbody>{rows.map((row, i) => <tr key={i} style={{ borderBottom: i === rows.length - 1 ? 0 : `1px solid ${brand.border}` }}>{row.map((cell, j) => <td key={j} style={{ textAlign: j ? 'right' : 'left', padding: '11px 13px', color: brand.text, fontFamily: j ? fonts.mono : fonts.body, whiteSpace: 'nowrap' }}>{cell}</td>)}</tr>)}</tbody> : <tbody><tr><td colSpan={headers.length} style={{ padding: 22, textAlign: 'center', color: brand.textMuted }}>{empty}</td></tr></tbody>}
    </table>
  </div>;
}

function usableRows(report: RetentionReport) {
  return report.months.filter(row => row.opening !== null);
}

export function RetentionReportContent({ data, mode = data.scope === 'network' ? 'network' : 'retention' }: Props) {
  const now = useMemo(() => new Date(data.asOf), [data.asOf]);
  const completedMonth = useMemo(() => {
    const locations = data.locations;
    if (!locations.length) return lastCompletedMonth(now, 'UTC');
    return locations.map(location => lastCompletedMonth(now, location.timezone)).sort()[0];
  }, [data.locations, now]);
  const [period, setPeriod] = useState<Period>('month');
  const [customStart, setCustomStart] = useState(completedMonth);
  const [customEnd, setCustomEnd] = useState(completedMonth);
  const [locationId, setLocationId] = useState('');
  const [division, setDivision] = useState('');
  const [sport, setSport] = useState('');
  const [gender, setGender] = useState('');
  const [competition, setCompetition] = useState('');

  const periodRange = useMemo(() => {
    const end = period === 'custom' ? customEnd : completedMonth;
    const length = period === 'quarter' ? 3 : period === 'year' ? 12 : 1;
    return { startMonth: period === 'custom' ? customStart : shiftMonth(end, -(length - 1)), endMonth: end };
  }, [period, customStart, customEnd, completedMonth]);
  const optionsSegments = useMemo(() => data.segments.filter(s => s.recorded_at <= data.asOf && s.effective_at.slice(0, 7) <= periodRange.endMonth), [data.segments, data.asOf, periodRange.endMonth]);
  const recordedDivisions = unique(optionsSegments.map(s => s.state.division));
  const divisions = [...DIVISIONS, ...recordedDivisions.filter(value => !DIVISIONS.includes(value))];
  const sports = unique(optionsSegments.map(s => s.state.sport));
  const genders = unique(optionsSegments.map(s => s.state.gender));
  const competitions = unique(optionsSegments.map(s => s.state.competition));
  const filters: RetentionFilters = { ...periodRange, locationId: locationId || undefined, division: division || undefined, sport: sport || undefined, gender: gender || undefined, competition: competition || undefined };
  const report = useMemo(() => buildRetentionReport(data, filters), [data, periodRange.startMonth, periodRange.endMonth, locationId, division, sport, gender, competition]);
  const benchmark = useMemo(() => buildRetentionReport(data, { ...filters, locationId: undefined }), [data, periodRange.startMonth, periodRange.endMonth, division, sport, gender, competition]);
  const isNetwork = mode === 'network' || data.scope === 'network';
  const primaryName = isNetwork ? 'Network Churn' : mode === 'churn' ? 'Member Churn' : 'Retention';
  const primaryRate = isNetwork || mode === 'churn' ? report.churnRate : report.retentionRate;
  const benchmarkRate = isNetwork || mode === 'churn' ? benchmark.churnRate : benchmark.retentionRate;
  const rows = usableRows(report);
  const isPartial = report.months.some(m => m.opening === null);
  const coverageStarts = [...new Set(data.coverage.map(item => item.started_at.slice(0, 10)))].sort();
  const periodText = periodRange.startMonth === periodRange.endMonth ? fmtMonth(periodRange.endMonth) : `${fmtMonth(periodRange.startMonth)} – ${fmtMonth(periodRange.endMonth)}`;
  const policyIssues = [...new Set(report.months.flatMap(m => m.unavailable))];
  const title = mode === 'churn' ? 'Churn analysis' : mode === 'network' ? 'Network churn analysis' : 'Member retention';

  return <div>
    <PageHeader title={title} subtitle="Evidence-led lifecycle reporting · complete local calendar months only" />
    <main style={{ padding: '22px clamp(14px, 3vw, 30px) 42px', display: 'grid', gap: 18, maxWidth: 1500, margin: '0 auto' }}>
      <section aria-labelledby="report-controls" style={{ ...panel, padding: 16 }}>
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 14, color: brand.gold, fontFamily: fonts.display, fontWeight: 700, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}><Filter size={15}/><h2 id="report-controls" style={{ margin: 0, font: 'inherit' }}>Report controls</h2></div>
        <div className="retention-controls">
          <SelectField label="Period" value={period} onChange={v => setPeriod(v as Period)} options={[{ value: 'month', label: 'Last completed month' }, { value: 'quarter', label: 'Last 3 completed months' }, { value: 'year', label: 'Last 12 completed months' }, { value: 'custom', label: 'Custom month range' }]} />
          {period === 'custom' && <><label style={labelStyle}>From month<input aria-label="From month" type="month" max={completedMonth} value={customStart} onChange={e => setCustomStart(e.target.value)} style={controlStyle}/></label><label style={labelStyle}>Through month<input aria-label="Through month" type="month" max={completedMonth} value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={controlStyle}/></label></>}
          <SelectField label="Location" value={locationId} onChange={setLocationId} options={[{ value: '', label: 'All permitted locations' }, ...data.locations.map(l => ({ value: l.id, label: l.name }))]} />
          <SelectField label="Division / age" value={division} onChange={setDivision} options={[{ value: '', label: 'All recorded divisions' }, ...divisions.map(v => ({ value: v, label: v })) , { value: 'unknown', label: 'Unknown / not recorded' }]} />
          <SelectField label="Sport" value={sport} onChange={setSport} options={[{ value: '', label: 'All recorded sports' }, ...sports.map(v => ({ value: v, label: v })), { value: 'unknown', label: 'Unknown / not recorded' }]} />
          <SelectField label="Gender" value={gender} onChange={setGender} options={[{ value: '', label: 'All recorded genders' }, ...genders.map(v => ({ value: v, label: v })), { value: 'unknown', label: 'Unknown / not recorded' }]} />
          <SelectField label="Rec / Travel / Both" value={competition} onChange={setCompetition} options={[{ value: '', label: 'All competition types' }, ...unique(['Rec', 'Travel', 'Both', ...competitions]).map(v => ({ value: v, label: v })), { value: 'unknown', label: 'Unknown / not recorded' }]} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', color: brand.textMuted, fontSize: 11 }}><CalendarDays size={14}/><span>Showing {periodText}. Latest fully completed month across permitted location timezones: <strong style={{ color: brand.text }}>{fmtMonth(completedMonth)}</strong>.</span></div>
      </section>

      {data.issues.length > 0 && <aside role="status" style={{ ...panel, borderColor: brand.warning, background: brand.warningBg, padding: 14 }}><strong style={{ color: brand.warning, fontSize: 12 }}>Source issues</strong><ul style={{ margin: '8px 0 0', paddingLeft: 20, color: brand.text, fontSize: 12 }}>{data.issues.map((issue, i) => <li key={`${issue}-${i}`}>{issue}</li>)}</ul></aside>}
      {data.policies.length === 0 && <aside style={{ ...panel, padding: 13, color: brand.textMuted, fontSize: 12 }}><CircleHelp size={14} style={{ verticalAlign: 'middle', marginRight: 7, color: brand.warning }}/>No approved reporting policy is supplied for this scope. Metrics remain unavailable until contract requirements are satisfied.</aside>}
      {policyIssues.length > 0 && <aside role="status" style={{ ...panel, padding: 14, borderColor: brand.warning, background: brand.warningBg }}><strong style={{ display: 'block', fontSize: 12, color: brand.warning, marginBottom: 7 }}>Coverage or policy limits this report</strong><ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, lineHeight: 1.65, color: brand.text }}>{policyIssues.map(reason => <li key={reason}>{reason}</li>)}</ul></aside>}

      {isPartial && <section style={{ ...panel, borderLeft: `3px solid ${brand.warning}`, padding: 14, color: brand.textMuted, fontSize: 12 }}>Some selected months are unavailable. Summary totals and detail rows are withheld rather than treating missing evidence as zero losses.</section>}
      <section className="retention-metrics" aria-label="Filtered report summary">
        <Metric title={primaryName} value={rate(primaryRate)} sub={primaryRate == null ? 'Unavailable under current evidence and filters' : `${report.unit} · ${periodText}`} accent={isNetwork ? brand.warning : brand.gold}/>
        <Metric title="Opening opportunities" value={count(report.opening)} sub="Player-month openings; multi-month totals are sums, not averages" accent={brand.info}/>
        <Metric title="Recorded losses" value={count(report.losses)} sub="Exit status evidenced at the completed local month close" accent={brand.danger}/>
        {isNetwork
          ? <Metric title="LTV" value="Unavailable" sub={data.finance.reason || 'Approved finance contract unavailable; no LTV formula is defined.'} accent={brand.warning}/>
          : mode === 'retention'
            ? <Metric title="Member churn" value={rate(report.churnRate)} sub="Losses divided by opening opportunities across the selected period" accent={brand.danger}/>
            : <Metric title="Retained at close" value={count(report.retained)} sub="Opening opportunities less evidenced losses" accent={brand.success}/>}
      </section>
      <div style={{ ...panel, padding: 13, display: 'flex', alignItems: 'flex-start', gap: 9, color: brand.textMuted, fontSize: 11, lineHeight: 1.55 }}><Users size={15} color={brand.goldDeep} style={{ flexShrink: 0, marginTop: 1 }}/><span>Unit: <strong style={{ color: brand.text }}>{report.unit}</strong>. Churn is total losses ÷ total opening opportunities. Historical evidence coverage begins {coverageStarts.length ? coverageStarts.map(date => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))).join(', ') : 'Unavailable'}. {isNetwork ? 'Network view contains aggregates only; player identities and location names are withheld.' : 'Retention is shown only for the owner report. No annualized rates, inferred reasons, or estimated lifetime value are used.'}</span></div>

      <section style={panel}>
        <div style={{ marginBottom: 13 }}><h2 style={sectionTitle}>Monthly trend</h2><p style={sectionSub}>Each month uses its own opening cohort denominator. Summary rates use the combined player-month totals.</p></div>
        <DataTable caption="Monthly retention and churn trend" headers={isNetwork ? ['Completed month', 'Opening opportunities', 'Losses', 'Churn'] : ['Completed month', 'Opening opportunities', 'Losses', 'Retained', 'Churn', 'Retention']} rows={report.months.map((m: RetentionRow) => isNetwork ? [fmtMonth(m.month), count(m.opening), count(m.losses), rate(m.churnRate)] : [fmtMonth(m.month), count(m.opening), count(m.losses), count(m.retained), rate(m.churnRate), rate(m.retentionRate)])} empty="No months are available for this selection."/>
      </section>

      <section className="retention-dimensions">
        <div style={panel}>
          <h2 style={sectionTitle}>Loss by tenure</h2><p style={sectionSub}>Current observed spell tenure at month opening; totals share the report denominator.</p>
          <DataTable caption="Opening opportunities and losses by tenure" headers={['Tenure at opening', 'Opening', 'Losses', 'Churn']} rows={report.tenure.map(b => [b.label, count(b.opening), count(b.losses), rate(b.churnRate)])} empty="Tenure breakdown is unavailable for this report."/>
        </div>
        <div style={panel}>
          <h2 style={sectionTitle}>Loss by division</h2><p style={sectionSub}>Division recorded at opening; unknown is retained as an explicit segment.</p>
          <DataTable caption="Opening opportunities and losses by division" headers={['Division', 'Opening', 'Losses', 'Churn']} rows={report.divisions.map(b => [b.label, count(b.opening), count(b.losses), rate(b.churnRate)])} empty="Division breakdown is unavailable for this report."/>
        </div>
      </section>

      <section style={panel}>
        <div style={{ marginBottom: 13 }}><h2 style={sectionTitle}>Scope benchmark</h2><p style={sectionSub}>Same completed months and segment filters, without the selected location filter.</p></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'baseline' }}><div><div style={eyebrow}>{isNetwork ? 'Authorized network scope' : 'Owner tenant scope'}</div><strong style={{ fontFamily: fonts.display, fontSize: 25, color: brand.gold }}>{rate(benchmarkRate)}</strong></div><div style={{ color: brand.textMuted, fontSize: 12 }}>Opening {count(benchmark.opening)} · losses {count(benchmark.losses)} · {benchmark.unit}</div></div>
        {benchmark.unavailable.length > 0 && <p style={{ color: brand.warning, fontSize: 11, marginBottom: 0 }}>{benchmark.unavailable.join(' ')}</p>}
      </section>

      <section style={panel}>
        <div style={{ marginBottom: 13 }}><h2 style={sectionTitle}>Lost players</h2><p style={sectionSub}>{isNetwork ? 'Privacy-preserving count by month only. No player identifiers or raw evidence are shown.' : 'Only contract-supported cancellation or nonrenewal exits with effective-date evidence.'}</p></div>
        {isNetwork ? <DataTable caption="Monthly aggregate loss counts" headers={['Month', 'Recorded losses']} rows={report.months.map(m => [fmtMonth(m.month), count(m.losses)])} empty="Loss counts are unavailable until coverage and policy requirements are met."/>
          : <DataTable caption="Lost player detail" headers={['Player', 'Month', 'Effective date', 'Recorded reason']} rows={report.lostPlayers.map(loss => {
            const href = playerHref({ kidId: loss.kidId });
            const timezone = data.locations.find(l => l.id === loss.locationId)?.timezone ?? 'UTC';
            return [href ? <Link key={loss.key} href={href} style={{ color: brand.gold, textDecoration: 'underline', textUnderlineOffset: 3 }}>{loss.name || 'Open player record'}</Link> : loss.name || 'Name unavailable', fmtMonth(loss.month), <span key={`${loss.key}:date`} title={`${loss.effectiveAt} · ${timezone}`}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: timezone }).format(new Date(loss.effectiveAt))} ({timezone})</span>, loss.reason === 'cancellation' ? 'Cancellation' : 'Nonrenewal'];
          })} empty="No evidence-backed loss rows are available. This does not mean there were zero losses; review coverage and policy notices above."/>}
      </section>

      {!isNetwork && <section className="retention-availability" aria-label="Unavailable dimensions">
        <div style={panel}><h2 style={sectionTitle}>Finance</h2><p style={sectionSub}>{data.finance.reason}</p><div style={eyebrow}>LTV and revenue impact unavailable</div></div>
        <div style={panel}><h2 style={sectionTitle}>Instructor attribution</h2><p style={sectionSub}>{data.instructors.reason}</p><div style={eyebrow}>Instructor loss breakdown unavailable</div></div>
      </section>}
    </main>
    <style jsx>{`
      .retention-controls { display:grid; grid-template-columns:repeat(4,minmax(150px,1fr)); gap:12px; }
      .retention-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
      .retention-dimensions, .retention-availability { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      @media(max-width:900px) { .retention-controls { grid-template-columns:repeat(2,minmax(0,1fr)); } .retention-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media(max-width:600px) { .retention-controls, .retention-metrics, .retention-dimensions, .retention-availability { grid-template-columns:1fr; } }
      select:focus-visible, input:focus-visible, [tabindex="0"]:focus-visible { outline:2px solid ${brand.gold}; outline-offset:2px; }
    `}</style>
  </div>;
}

const sectionTitle: CSSProperties = { margin: 0, color: brand.text, fontFamily: fonts.display, fontSize: 15, letterSpacing: 0.6, textTransform: 'uppercase' };
const sectionSub: CSSProperties = { margin: '4px 0 12px', color: brand.textMuted, fontSize: 11, lineHeight: 1.5 };
const eyebrow: CSSProperties = { color: brand.textMuted, fontFamily: fonts.display, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' };
