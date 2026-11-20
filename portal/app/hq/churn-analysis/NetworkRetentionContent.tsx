import type { RetentionDataset, RetentionFilters } from '@/lib/retention/types';
import { buildRetentionReport, DIVISIONS, lastCompletedMonth, shiftMonth } from '@/lib/retention/engine';
import { brand } from '@/lib/ownerBrandTokens';

/** Server component: network browser responses contain aggregates, not player history. */
export function NetworkRetentionContent({ data, searchParams }: {
  data: RetentionDataset;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const param = (key: string) => typeof searchParams[key] === 'string' ? searchParams[key] as string : '';
  const last = data.locations.map(l => lastCompletedMonth(new Date(data.asOf), l.timezone)).sort()[0]
    ?? lastCompletedMonth(new Date(data.asOf));
  const mode = param('period') || 'month';
  const endMonth = param('endMonth') || last;
  const validEnd = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(endMonth);
  const filters: RetentionFilters = {
    startMonth: mode === 'custom' ? param('startMonth') || last
      : validEnd ? shiftMonth(endMonth, mode === 'year' ? -11 : mode === 'quarter' ? -2 : 0) : endMonth,
    endMonth, locationId: param('locationId') || undefined,
    division: param('division') || undefined, sport: param('sport') || undefined,
    gender: param('gender') || undefined, competition: param('competition') || undefined,
  };
  const report = buildRetentionReport(data, filters);
  const benchmark = buildRetentionReport(data, { ...filters, locationId: undefined });
  const pct = (n: number | null) => n === null ? 'Unavailable' : `${n}%`;
  const fieldStyle = { padding: 8, border: `1px solid ${brand.border}`, borderRadius: 6, background: brand.surface, color: brand.text };
  const select = (name: string, title: string, options: Array<{ value: string; label: string }>) => (
    <label style={{ display: 'grid', gap: 6 }}>{title}
      <select name={name} defaultValue={param(name)} style={fieldStyle}>
        <option value="">All</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
  const observed = (key: 'sport' | 'gender') => [...new Set(data.segments.map(s => s.state[key]).filter((x): x is string => !!x))]
    .sort().map(value => ({ value, label: value })).concat({ value: 'unknown', label: 'Unknown' });
  return <main style={{ padding: 24, color: brand.text, background: brand.darker, minHeight: '100%' }}>
    <h1>Network Churn &amp; LTV</h1>
    <p>Last completed month: {last}. Authorized network aggregates only; no player names or records are shared.</p>
    <form style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'end', margin: '24px 0' }}>
      <label>Period <select name="period" defaultValue={mode} style={fieldStyle}>
        <option value="month">Month</option><option value="quarter">Quarter (3 months)</option>
        <option value="year">Year (12 months)</option><option value="custom">Custom</option>
      </select></label>
      <label>Custom start <input type="month" name="startMonth" defaultValue={filters.startMonth} max={last} style={fieldStyle} /></label>
      <label>Through month <input type="month" name="endMonth" defaultValue={filters.endMonth} max={last} style={fieldStyle} /></label>
      {select('locationId', 'Location', data.locations.map(l => ({ value: l.id, label: l.name })))}
      {select('division', 'Age / division', [...DIVISIONS.map(value => ({ value, label: value })), { value: 'unknown', label: 'Unknown' }])}
      {select('sport', 'Sport', observed('sport'))}
      {select('gender', 'Gender', observed('gender'))}
      {select('competition', 'Rec / Travel / Both', ['Rec', 'Travel', 'Both', 'unknown'].map(value => ({ value, label: value })))}
      <button type="submit" style={fieldStyle}>Apply filters</button>
    </form>
    <p>{filters.startMonth} through {filters.endMonth} · Local reporting timezones · Unit: {report.unit}</p>
    {report.unavailable.length > 0 && <section role="status"><h2>Unavailable results</h2>
      <ul>{report.unavailable.map(issue => <li key={issue}>{issue}</li>)}</ul></section>}
    <dl style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
      <div><dt>Network Churn</dt><dd>{pct(report.churnRate)}</dd></div>
      <div><dt>Opening opportunities</dt><dd>{report.opening ?? 'Unavailable'}</dd></div>
      <div><dt>Losses</dt><dd>{report.losses ?? 'Unavailable'}</dd></div>
      <div><dt>Network benchmark</dt><dd>{pct(benchmark.churnRate)}</dd></div>
      <div><dt>LTV</dt><dd>Unavailable</dd></div>
    </dl>
    <p>{data.finance.reason}</p>
    <h2>Monthly starting-cohort trend</h2>
    <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
      <thead><tr>{['Month', 'Opening players', 'Losses', 'Network Churn', 'Evidence'].map(h => <th key={h} style={{ padding: 10 }}>{h}</th>)}</tr></thead>
      <tbody>{report.months.map(m => <tr key={m.month}>
        <td style={{ padding: 10 }}>{m.month}</td><td>{m.opening ?? 'Unavailable'}</td>
        <td>{m.losses ?? 'Unavailable'}</td><td>{pct(m.churnRate)}</td><td>{m.unavailable.join(' ') || 'Reconciled'}</td>
      </tr>)}</tbody>
    </table></div>
    {[{ title: 'Tenure at opening', rows: report.tenure }, { title: 'Division recorded at opening', rows: report.divisions }].map(section =>
      <section key={section.title}><h2>{section.title}</h2>
        {section.rows.length ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left' }}>
          <thead><tr><th>Segment</th><th>Opening opportunities</th><th>Losses</th><th>Churn</th></tr></thead>
          <tbody>{section.rows.map(row => <tr key={row.label}><td style={{ padding: 10 }}>{row.label}</td><td>{row.opening}</td><td>{row.losses}</td><td>{pct(row.churnRate)}</td></tr>)}</tbody>
        </table></div> : <p>Unavailable — approved policy and complete historical evidence are required.</p>}
      </section>)}
    <h2>Actual instructor dimension</h2><p>{data.instructors.reason}</p>
    <details><summary>Definitions and policy dependencies</summary>
      <p>Monthly losses / players present at the opening of each month. Multi-month rates use summed player-month opportunities, never averages of location rates.</p>
      <p>Age divisions are recorded classifications, not birthday-derived reconstructions. Tenure after day 360, birthday and season rules, school overrides and privacy require explicit approval. Unknown prior history stays unknown.</p>
      <p>Network player-level loss records are withheld under the aggregate-only privacy contract. Location owners can review authorized player names and effective loss dates.</p>
    </details>
  </main>;
}
