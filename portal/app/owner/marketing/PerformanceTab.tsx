'use client';

import { useEffect, useState } from 'react';
import { Chip, OCard, SectionHeader } from '@/components/owner/ui';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  formatMultiple,
  formatPayback,
  formatRoi,
  presentEconomics,
} from '@/lib/marketing/economics/calc';
import { sampleCohortFacts } from '@/lib/marketing/economics/fixtures';
import type { CampaignEconomics, EconomicsSource, EconomicsView, Horizon } from '@/lib/marketing/economics/types';
import { formatIsoDate, formatMinor } from '@/lib/marketing/metrics';
import { SAMPLE_LABEL } from '@/lib/marketing/types';
import './ads.css';
import './performance.css';

type Section = 'overview' | 'campaigns' | 'cohorts' | 'costs';

const controlStyle = {
  background: brand.surfaceAlt,
  color: brand.text,
  border: `1px solid ${brand.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: fonts.body,
  minHeight: 44,
};

function feeCentsFromInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const cents = Math.round(Number(trimmed) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function money(cents: number | null, currency: string | null): string {
  return formatMinor(cents, currency);
}

function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
}

export function PerformanceTab({ preview = false, initialSection = 'overview', initialDrawer = false }: {
  preview?: boolean;
  initialSection?: Section;
  initialDrawer?: boolean;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [horizon, setHorizon] = useState<Horizon>('realized');
  const [source, setSource] = useState<EconomicsSource>('meta');
  const [feeInput, setFeeInput] = useState('1000');
  const [drawer, setDrawer] = useState<CampaignEconomics | null>(() => {
    if (!preview || !initialDrawer) return null;
    const first = presentEconomics(sampleCohortFacts(100_000), 'meta', 'realized').selected.campaigns[0];
    return first ?? null;
  });
  const [live, setLive] = useState<EconomicsView | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ horizon, source });
    fetch(`/api/owner/marketing/economics?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as EconomicsView & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Performance could not be loaded');
        return body;
      })
      .then((body) => { setLive(body); setLiveError(null); })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setLiveError(cause instanceof Error ? cause.message : 'Performance could not be loaded');
      });
    return () => controller.abort();
  }, [preview, horizon, source]);

  const view = preview
    ? presentEconomics(sampleCohortFacts(feeCentsFromInput(feeInput)), source, horizon)
    : live;
  const selected = view?.selected ?? null;
  const currency = view?.currency ?? null;
  const rows = selected ? [...selected.campaigns, selected.unallocated].filter((row) => (
    row.mediaSpendCents || row.feeCents || row.leads || row.acquiredFamilies || row.netCollectionsCents
  )) : [];

  const bridge = selected ? [
    ['Net collections', selected.netCollectionsCents, brand.gold],
    ['Direct delivery cost', selected.directCostCents, '#e2ae92'],
    ['Realized gross profit', selected.grossProfitCents, '#91c5ae'],
    ['Acquisition cost', selected.acquisitionCostCents, '#b2b9c9'],
    ['Contribution after marketing', selected.contributionCents, brand.gold],
  ] as const : [];
  const scale = Math.max(...bridge.map((item) => Math.abs(item[1] ?? 0)), 1);

  return (
    <div
      className="mkt mkt-econ"
      data-screen="marketing-performance"
      style={{
        ['--mkt-line' as string]: brand.border,
        ['--mkt-muted' as string]: brand.textMuted,
        ['--mkt-text' as string]: brand.text,
        ['--mkt-gold' as string]: brand.gold,
        ['--mkt-panel' as string]: brand.surfaceAlt,
      }}
    >
      {preview && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', background: brand.surfaceAlt, border: `1px solid ${brand.goldDeep}`, borderRadius: 8, marginBottom: 16 }}>
          <Chip color="gold" size="sm">Sample data</Chip>
          <span style={{ fontSize: 13, color: brand.text }}>{SAMPLE_LABEL}</span>
        </div>
      )}

      <div className="mkt-filters">
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
          Location
          <input aria-label="Location" readOnly value={view?.locationLabel ?? 'This location'} style={controlStyle} />
        </label>
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
          Source
          <select aria-label="Source" value={source} style={controlStyle} onChange={(event) => setSource(event.target.value as EconomicsSource)}>
            <option value="meta">Paid Meta</option>
            <option value="organic">Organic</option>
            <option value="referral">Referral</option>
            <option value="unknown">Unknown</option>
            <option value="all">All sources</option>
          </select>
        </label>
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
          Cohort
          <input aria-label="Cohort" readOnly value={view?.cohortLabel ?? 'Selected cohort'} style={controlStyle} />
        </label>
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
          Observation horizon
          <select aria-label="Observation horizon" value={horizon} style={controlStyle} onChange={(event) => setHorizon(event.target.value as Horizon)}>
            <option value="realized">Realized to date</option>
            <option value="d90">First 90 days</option>
            <option value="d30">First 30 days</option>
          </select>
        </label>
      </div>

      <p style={{ margin: '0 0 12px', color: brand.textMuted, fontSize: 13 }}>
        {view ? `${view.cohortLabel} · observed through ${formatIsoDate(view.asOf)}` : 'Loading performance…'}
        {preview ? ' · sample cohort, not a connected account' : ''}
      </p>
      {liveError && <div className="mkt-econ-note" style={{ marginBottom: 12 }}>{liveError}</div>}

      <div className="mkt-econ-nav" role="tablist" aria-label="Performance sections">
        {([
          ['overview', 'Overview'],
          ['campaigns', 'Campaigns'],
          ['cohorts', 'Cohort value'],
          ['costs', 'Costs & coverage'],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={section === key} onClick={() => setSection(key)}>{label}</button>
        ))}
      </div>

      {selected && section === 'overview' && (
        <div>
          <div className="mkt-econ-cards">
            <article className="mkt-econ-card"><span>Acquisition cost</span><strong>{money(selected.acquisitionCostCents, currency)}</strong><span>Media + acquisition fees</span></article>
            <article className="mkt-econ-card"><span>New paying families</span><strong>{selected.acquiredFamilies === null ? 'unavailable' : selected.acquiredFamilies}</strong><span>First-time payers</span></article>
            <article className="mkt-econ-card"><span>Tracked all-in CAC</span><strong>{money(selected.cacCents, currency)}</strong><span>Per acquired family</span></article>
            <article className="mkt-econ-card"><span>After marketing</span><strong>{money(selected.contributionCents, currency)}</strong><span>Contribution before fixed overhead</span></article>
          </div>
          <div className="mkt-econ-split">
            <OCard>
              <SectionHeader title="From collections to contribution" subtitle="Attributed cash and direct costs for this cohort" />
              {bridge.map(([label, value, color]) => (
                <div className="mkt-econ-bar" key={label}>
                  <div><span>{label}</span><b>{money(value, currency)}</b></div>
                  <div className="mkt-econ-track">
                    <div className="mkt-econ-fill" style={{ width: `${value === null ? 0 : (Math.abs(value) / scale) * 100}%`, background: value !== null && value < 0 ? '#e2ae92' : color }} />
                  </div>
                </div>
              ))}
            </OCard>
            <OCard>
              <SectionHeader title="Returns" subtitle="Media ROAS uses ad spend. All-in measures include the fee." />
              {[
                ['Media ROAS', formatMultiple(selected.mediaRoas)],
                ['All-in revenue return', formatMultiple(selected.allInReturn)],
                ['Gross profit per family', money(selected.ltgpPerFamilyCents, currency)],
                ['LTGP:CAC', formatMultiple(selected.ltgpToCac)],
                ['Marketing ROI', formatRoi(selected.roi)],
                ['Payback', formatPayback(selected.payback)],
              ].map(([label, value]) => (
                <div className="mkt-econ-line" key={label}><span>{label}</span><b>{value}</b></div>
              ))}
            </OCard>
          </div>
          <OCard>
            <SectionHeader title="From inquiry to first payment" subtitle="A skipped stage stays blank. Counts are not treated as sales." />
            <div className="mkt-econ-stages">
              {[
                ['CRM leads', selected.funnel.leads === null ? 'unavailable' : String(selected.funnel.leads)],
                ['Evaluations booked', selected.funnel.evaluationsBooked === null ? 'unavailable' : String(selected.funnel.evaluationsBooked)],
                ['Evaluations attended', selected.funnel.evaluationsAttended === null ? 'unavailable' : String(selected.funnel.evaluationsAttended)],
                ['New paying families', selected.funnel.payers === null ? 'unavailable' : String(selected.funnel.payers)],
                ['Lead-to-paid', formatRoi(selected.funnel.leadToPaid)],
              ].map(([label, value]) => (
                <div className="mkt-econ-stage" key={label}><b>{value}</b>{label}</div>
              ))}
            </div>
            {selected.notes.length > 0 && (
              <div className="mkt-econ-note" style={{ marginTop: 12 }}>{selected.notes.join(' ')}</div>
            )}
          </OCard>
        </div>
      )}

      {selected && section === 'campaigns' && (
        <OCard>
          <SectionHeader title="Campaign performance" subtitle="Service fee allocated by media spend. Unallocated cash is not spread across campaigns." />
          <div style={{ overflowX: 'auto' }}>
            <table className="mkt-econ-table">
              <thead>
                <tr>
                  {['Campaign', 'Media', 'CRM leads', 'New families', 'Net collections', 'Media ROAS', 'All-in CAC', ''].map((label) => <th key={label || 'details'}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td data-label="Campaign">No campaign rows.</td></tr>}
                {rows.map((row) => (
                  <tr key={row.id ?? 'unallocated'}>
                    <td data-label="Campaign">{row.name}</td>
                    <td data-label="Media">{money(row.mediaSpendCents, currency)}</td>
                    <td data-label="CRM leads">{row.leads === null ? 'unavailable' : row.leads}</td>
                    <td data-label="New families">{row.acquiredFamilies === null ? 'unavailable' : row.acquiredFamilies}</td>
                    <td data-label="Net collections">{money(row.netCollectionsCents, currency)}</td>
                    <td data-label="Media ROAS">{formatMultiple(row.mediaRoas)}</td>
                    <td data-label="All-in CAC">{money(row.cacCents, currency)}</td>
                    <td data-label="Details">
                      <button type="button" className="mkt-econ-details" style={controlStyle} onClick={() => { if (isPhone()) setDrawer(row); }}>Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OCard>
      )}

      {view && section === 'cohorts' && (
        <OCard>
          <SectionHeader title={`${view.cohortLabel} cohort value by age`} subtitle="Each horizon starts at the lead date. A horizon the cohort has not reached is unavailable." />
          <div style={{ overflowX: 'auto' }}>
            <table className="mkt-econ-table">
              <thead>
                <tr>{['Horizon', 'Net collections', 'Direct costs', 'GP per family', 'LTGP:CAC', 'Contribution'].map((label) => <th key={label}>{label}</th>)}</tr>
              </thead>
              <tbody>
                {(['d30', 'd90', 'realized'] as const).map((key) => {
                  const row = view.horizons[key];
                  const label = key === 'd30' ? 'First 30 days' : key === 'd90' ? 'First 90 days' : 'To date';
                  return (
                    <tr key={key}>
                      <td data-label="Horizon">{label}{row.mature ? '' : ' · not yet mature'}</td>
                      <td data-label="Net collections">{money(row.netCollectionsCents, currency)}</td>
                      <td data-label="Direct costs">{money(row.directCostCents, currency)}</td>
                      <td data-label="GP per family">{money(row.ltgpPerFamilyCents, currency)}</td>
                      <td data-label="LTGP:CAC">{formatMultiple(row.ltgpToCac)}</td>
                      <td data-label="Contribution">{money(row.contributionCents, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </OCard>
      )}

      {selected && section === 'costs' && (
        <OCard>
          <SectionHeader title="Costs & coverage" subtitle={preview ? 'The sample fee is local to this page. It does not create an expense.' : 'Live acquisition cost waits for an approved expense and connected Meta spend.'} />
          {preview && (
            <div className="mkt-filters">
              <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
                July agency service fee (USD)
                <input aria-label="July agency service fee" inputMode="decimal" value={feeInput} style={controlStyle} onChange={(event) => setFeeInput(event.target.value)} />
              </label>
              <button type="button" style={{ ...controlStyle, cursor: 'pointer' }} onClick={() => setFeeInput('1000')}>Restore $1,000</button>
            </div>
          )}
          {[
            ['Meta media spend', money(selected.mediaSpendCents, currency)],
            ['Marketing service fee', money(selected.feeCents, currency)],
            ['Total tracked acquisition cost', money(selected.acquisitionCostCents, currency)],
            ['First-time payers with verified origin', selected.acquiredFamilies === null ? 'unavailable' : `${selected.acquiredFamilies} of ${selected.leadCount ?? 'unavailable'}`],
            ['Ad-level coverage', selected.adLevelLabeled],
            ['Direct cost basis', selected.directCostCents === null ? 'unavailable' : (preview ? 'Supplied sample costs' : 'Connected')],
            ['Cost per attended evaluation', money(selected.costPerAttendedCents, currency)],
          ].map(([label, value]) => (
            <div className="mkt-econ-line" key={label}><span>{label}</span><b>{value}</b></div>
          ))}
          <p className="mkt-econ-note">Changing this fee does not write billing, CRM, or the expense table. Media ROAS ignores the fee. All-in CAC, return, LTGP:CAC, ROI, and contribution use it.</p>
        </OCard>
      )}

      {drawer && (
        <div className="mkt-drawer" style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 50 }}>
          <button type="button" aria-label="Close details" onClick={() => setDrawer(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', border: 0, width: '100%' }} />
          <aside role="dialog" aria-modal="true" aria-label={`${drawer.name} details`} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '86vh', overflow: 'auto', borderRadius: '16px 16px 0 0', padding: '18px 16px 28px', background: brand.surface, color: brand.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontFamily: fonts.display, fontSize: 22 }}>{drawer.name}</h2>
              <button type="button" onClick={() => setDrawer(null)} style={{ ...controlStyle, cursor: 'pointer' }}>Close</button>
            </div>
            {[
              ['Media', money(drawer.mediaSpendCents, currency)],
              ['Allocated fee', money(drawer.feeCents, currency)],
              ['CRM leads', drawer.leads === null ? 'unavailable' : String(drawer.leads)],
              ['New families', drawer.acquiredFamilies === null ? 'unavailable' : String(drawer.acquiredFamilies)],
              ['Net collections', money(drawer.netCollectionsCents, currency)],
              ['Media ROAS', formatMultiple(drawer.mediaRoas)],
              ['All-in CAC', money(drawer.cacCents, currency)],
            ].map(([label, value]) => (
              <div className="mkt-econ-line" key={label}><span>{label}</span><b>{value}</b></div>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}
