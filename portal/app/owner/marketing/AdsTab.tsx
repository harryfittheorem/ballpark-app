'use client';

import { useEffect, useState } from 'react';
import { Chip, KPICard, OCard, SectionHeader } from '@/components/owner/ui';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  formatCount,
  formatFrequency,
  formatIsoDate,
  formatMinor,
  formatPercent,
} from '@/lib/marketing/metrics';
import type { EntityLevel, EntityRow, MarketingMetaResponse } from '@/lib/marketing/types';
import { SAMPLE_LABEL } from '@/lib/marketing/types';
import { DollarSign, Eye, Info, MousePointerClick, Radio, TrendingUp, Users } from 'lucide-react';
import './ads.css';

type Preset = '7' | '28' | '90' | 'custom';
type Drill =
  | { level: 'campaign' }
  | { level: 'adset'; campaignId: string; campaignName: string }
  | { level: 'ad'; campaignId: string; campaignName: string; adsetId: string; adsetName: string };

const controlStyle = {
  background: brand.surfaceAlt,
  color: brand.text,
  border: `1px solid ${brand.border}`,
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 13,
  fontFamily: fonts.body,
};

function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
}

function drillLabel(level: EntityLevel): string {
  if (level === 'adset') return 'Ad sets';
  if (level === 'ad') return 'Ads';
  return 'Campaigns';
}

export function AdsTab({ preview = false, initialReport = null }: {
  preview?: boolean;
  initialReport?: MarketingMetaResponse | null;
}) {
  const [report, setReport] = useState<MarketingMetaResponse | null>(initialReport);
  const [children, setChildren] = useState<EntityRow[] | null>(null);
  const [loading, setLoading] = useState(!initialReport);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [locationId, setLocationId] = useState(initialReport?.location_id ?? '');
  const [preset, setPreset] = useState<Preset>('7');
  const [from, setFrom] = useState(initialReport?.window.from ?? '');
  const [to, setTo] = useState(initialReport?.window.to ?? '');
  const [drill, setDrill] = useState<Drill>({ level: 'campaign' });
  const [drawer, setDrawer] = useState<EntityRow | null>(null);

  useEffect(() => {
    if (preset === 'custom' && (!from || !to)) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    if (preview) params.set('preview', '1');
    if (locationId) params.set('location', locationId);
    if (preset === 'custom') {
      params.set('from', from);
      params.set('to', to);
    } else {
      params.set('preset', preset);
    }
    if (drill.level === 'adset') {
      params.set('level', 'adset');
      params.set('parent', drill.campaignId);
    } else if (drill.level === 'ad') {
      params.set('level', 'ad');
      params.set('parent', drill.adsetId);
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/owner/marketing/meta?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as MarketingMetaResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Ads could not be loaded');
        return body;
      })
      .then((body) => {
        if (body.entity_level === 'campaign') {
          setReport(body);
          setChildren(null);
          setLocationId((current) => current || body.location_id || '');
        } else {
          setChildren(body.entities);
        }
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setError(cause instanceof Error ? cause.message : 'Ads could not be loaded');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [preview, locationId, preset, from, to, drill, retry]);

  const summary = report?.summary ?? null;
  const rows = drill.level === 'campaign' ? (report?.entities ?? []) : (children ?? []);
  const currency = report?.currency ?? null;

  function resetDrill() {
    setDrill({ level: 'campaign' });
    setDrawer(null);
    setChildren(null);
  }

  function openRow(row: EntityRow) {
    if (isPhone()) {
      setDrawer(row);
      return;
    }
    goDeeper(row);
  }

  function goDeeper(row: EntityRow) {
    setDrawer(null);
    if (row.level === 'campaign') {
      setDrill({ level: 'adset', campaignId: row.id, campaignName: row.name });
      return;
    }
    if (row.level === 'adset' && drill.level !== 'campaign') {
      const campaignId = drill.level === 'ad' ? drill.campaignId : drill.campaignId;
      const campaignName = drill.level === 'ad' ? drill.campaignName : drill.campaignName;
      setDrill({ level: 'ad', campaignId, campaignName, adsetId: row.id, adsetName: row.name });
    }
  }

  return (
    <div className="mkt" style={{ ['--mkt-line' as string]: brand.border, ['--mkt-muted' as string]: brand.textMuted }}>
      {report?.mode === 'sample' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', background: brand.surfaceAlt, border: `1px solid ${brand.goldDeep}`, borderRadius: 8, marginBottom: 16 }}>
          <Chip color="gold" size="sm">Sample data</Chip>
          <span style={{ fontSize: 13, color: brand.text }}>{SAMPLE_LABEL}</span>
        </div>
      )}

      <div className="mkt-filters">
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
          Location
          <select
            aria-label="Location"
            value={locationId}
            style={controlStyle}
            onChange={(event) => { setLocationId(event.target.value); resetDrill(); }}
          >
            {(report?.locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </select>
        </label>
        <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
          Dates
          <select
            aria-label="Date range"
            value={preset}
            style={controlStyle}
            onChange={(event) => {
              const next = event.target.value as Preset;
              if (next === 'custom' && report) {
                setFrom(report.window.from);
                setTo(report.window.to);
              }
              setPreset(next);
              resetDrill();
            }}
          >
            <option value="7">Last 7 complete days</option>
            <option value="28">Last 28 complete days</option>
            <option value="90">Last 90 complete days</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {preset === 'custom' && (
          <>
            <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
              From
              <input aria-label="From" type="date" value={from} style={controlStyle} onChange={(event) => { setFrom(event.target.value); resetDrill(); }} />
            </label>
            <label style={{ color: brand.textMuted, fontSize: 11, fontWeight: 700 }}>
              To
              <input aria-label="To" type="date" value={to} style={controlStyle} onChange={(event) => { setTo(event.target.value); resetDrill(); }} />
            </label>
          </>
        )}
      </div>

      {error && (
        <OCard style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: brand.text }}>{error}</div>
          <button type="button" onClick={() => setRetry((value) => value + 1)} style={{ ...controlStyle, marginTop: 10, cursor: 'pointer' }}>Retry</button>
        </OCard>
      )}

      {loading && !report && <div style={{ fontSize: 13, color: brand.textMuted }}>Loading ads…</div>}

      {report && (
        <>
          <div className="mkt-quality" style={{ fontSize: 12, color: brand.textMuted }}>
            <div><strong style={{ color: brand.text }}>Account</strong><div>{report.ad_account_label}</div></div>
            <div><strong style={{ color: brand.text }}>Currency</strong><div>{report.currency ?? 'unavailable'}</div></div>
            <div><strong style={{ color: brand.text }}>Timezone</strong><div>{report.timezone ?? 'unavailable'}</div></div>
            <div><strong style={{ color: brand.text }}>Attribution</strong><div>{report.attribution_label}</div></div>
            <div><strong style={{ color: brand.text }}>Last complete day</strong><div>{formatIsoDate(report.last_complete_date)}</div></div>
            <div><strong style={{ color: brand.text }}>Incomplete</strong><div>{report.incomplete ? 'Yes' : 'No'}</div></div>
            {report.graph_version && <div><strong style={{ color: brand.text }}>Graph</strong><div>{report.graph_version}</div></div>}
          </div>
          {(() => {
            const notices = [
              report.config_error ? 'Ad account mapping is not configured correctly.' : null,
              report.incomplete ? 'This response is incomplete. A results cursor was still open, so totals can be short.' : null,
              report.window_includes_open_day ? `The range goes past the last complete account day (${formatIsoDate(report.last_complete_date)}). That day is still open.` : null,
              report.timezone_note,
              report.mode === 'sample' ? null : report.note,
            ].filter((line): line is string => Boolean(line));
            if (notices.length === 0) return null;
            return (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', background: brand.surfaceAlt, border: `1px solid ${brand.border}`, borderRadius: 8, marginBottom: 16, fontSize: 12, color: brand.textMuted }}>
                <Info size={14} color={brand.info} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>{notices.map((line) => <div key={line}>{line}</div>)}</div>
              </div>
            );
          })()}

          {report.connection === 'not_connected' ? (
            <OCard>
              <SectionHeader title="Not connected" subtitle={report.locations.find((item) => item.id === report.location_id)?.name ?? 'This location'} />
              <div style={{ fontSize: 13, color: brand.textMuted, lineHeight: 1.5 }}>
                No Meta ad account is mapped to this location. Sample numbers are not shown on a live connection.
              </div>
            </OCard>
          ) : summary && (
            <>
              <SectionHeader
                title="Meta ads"
                subtitle={`${formatIsoDate(report.window.from)} – ${formatIsoDate(report.window.to)} · ${report.timezone ?? 'timezone unavailable'}`}
              />
              <div className="mkt-kpis">
                <KPICard label="Ad spend" value={formatMinor(summary.spend_minor, currency)} icon={DollarSign} color="gold" />
                <KPICard label="Meta leads" value={formatCount(summary.leads)} icon={Users} deltaLabel="Typed lead actions only" />
                <KPICard label="Meta CPL" value={formatMinor(summary.cpl_minor, currency)} icon={TrendingUp} />
                <KPICard label="Link CTR" value={formatPercent(summary.link_ctr)} icon={MousePointerClick} />
              </div>
              <div className="mkt-kpis">
                <KPICard label="CPC" value={formatMinor(summary.cpc_minor, currency)} icon={DollarSign} deltaLabel="Spend / link clicks" />
                <KPICard label="Impressions" value={formatCount(summary.impressions)} icon={Eye} />
                <KPICard label="Reach" value={formatCount(summary.reach)} icon={Radio} deltaLabel="Window total, not summed" />
                <KPICard label="Frequency" value={formatFrequency(summary.frequency)} icon={TrendingUp} deltaLabel="Impressions / reach" />
              </div>

              <SectionHeader title="Daily spend" subtitle="Each bar is one account day. Reach is not added across days." />
              <OCard style={{ marginBottom: 20 }}>
                <div className={`mkt-trend${report.daily.length > 14 ? ' is-dense' : ''}`} role="img" aria-label="Daily ad spend">
                  {report.daily.map((day) => {
                    const max = Math.max(...report.daily.map((item) => item.spend_minor ?? 0), 1);
                    const height = day.spend_minor === null ? 0 : Math.max(2, (day.spend_minor / max) * 100);
                    return (
                      <div key={day.date} className="mkt-trend-col" title={`${day.date}: ${formatMinor(day.spend_minor, currency)}`}>
                        <div className="mkt-trend-bar" style={{ height: `${height}%`, background: day.spend_minor === null ? brand.border : brand.goldDeep }} />
                        <span style={{ color: brand.textMuted }}>{day.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </OCard>
            </>
          )}

          {report.connection !== 'not_connected' && (
            <>
              <div className="mkt-crumb">
                <button type="button" onClick={resetDrill} style={{ color: drill.level === 'campaign' ? brand.gold : brand.textMuted, fontFamily: fonts.display, fontWeight: 700, fontSize: 13 }}>Campaigns</button>
                {drill.level !== 'campaign' && (
                  <>
                    <span style={{ color: brand.textMuted }}>/</span>
                    <button
                      type="button"
                      style={{ color: drill.level === 'adset' ? brand.gold : brand.textMuted, fontFamily: fonts.display, fontWeight: 700, fontSize: 13 }}
                      onClick={() => {
                        if (drill.level === 'ad') setDrill({ level: 'adset', campaignId: drill.campaignId, campaignName: drill.campaignName });
                        setDrawer(null);
                      }}
                    >{drill.campaignName}</button>
                  </>
                )}
                {drill.level === 'ad' && (
                  <>
                    <span style={{ color: brand.textMuted }}>/</span>
                    <span style={{ color: brand.gold, fontFamily: fonts.display, fontWeight: 700, fontSize: 13 }}>{drill.adsetName}</span>
                  </>
                )}
              </div>
              <SectionHeader title={drillLabel(drill.level === 'campaign' ? 'campaign' : drill.level)} subtitle={loading ? 'Loading…' : 'Select a row to open the next level'} />
              <div className="mkt-table-scroll" style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12 }}>
                <table className="mkt-entity-table">
                  <thead>
                    <tr style={{ background: brand.surfaceAlt, color: brand.textMuted, fontFamily: fonts.display }}>
                      {['Name', 'Spend', 'Leads', 'Meta CPL', 'Link CTR', 'CPC', 'Impressions', 'Reach', 'Frequency', ''].map((label) => (
                        <th key={label || 'details'}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ color: brand.textMuted }}>No rows in this window.</td>
                      </tr>
                    )}
                    {rows.map((row) => (
                      <tr key={row.id} onClick={() => openRow(row)} style={{ borderTop: `1px solid ${brand.border}`, cursor: 'pointer', color: brand.text }}>
                        <td data-label="Name" style={{ fontWeight: 700 }}>{row.name}</td>
                        <td data-label="Spend">{formatMinor(row.spend_minor, currency)}</td>
                        <td data-label="Leads">{formatCount(row.leads)}</td>
                        <td data-label="Meta CPL">{formatMinor(row.cpl_minor, currency)}</td>
                        <td data-label="Link CTR">{formatPercent(row.link_ctr)}</td>
                        <td data-label="CPC">{formatMinor(row.cpc_minor, currency)}</td>
                        <td data-label="Impressions">{formatCount(row.impressions)}</td>
                        <td data-label="Reach">{formatCount(row.reach)}</td>
                        <td data-label="Frequency">{formatFrequency(row.frequency)}</td>
                        <td data-label="Details">
                          {row.level !== 'ad' && (
                            <button type="button" className="mkt-details-btn" style={{ ...controlStyle, cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); setDrawer(row); }}>
                              Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <OCard style={{ marginTop: 20 }}>
            <SectionHeader title="Acquisition economics" subtitle="Available after CRM + payments connect (Phase B/C)" />
            <div style={{ fontSize: 13, color: brand.textMuted, lineHeight: 1.5 }}>
              CAC, ROAS, and the lead-to-member funnel are available after CRM + payments connect (Phase B/C).
            </div>
          </OCard>
        </>
      )}

      {drawer && (
        <div className="mkt-drawer">
          <button type="button" className="mkt-drawer-backdrop" aria-label="Close details" onClick={() => setDrawer(null)} />
          <aside className="mkt-drawer-panel" role="dialog" aria-modal="true" aria-label={`${drawer.name} details`} style={{ background: brand.surface, color: brand.text, borderTop: `1px solid ${brand.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontFamily: fonts.display, fontSize: 22 }}>{drawer.name}</h2>
              <button type="button" onClick={() => setDrawer(null)} style={{ ...controlStyle, cursor: 'pointer' }}>Close</button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
              {[
                ['Spend', formatMinor(drawer.spend_minor, currency)],
                ['Leads', formatCount(drawer.leads)],
                ['Meta CPL', formatMinor(drawer.cpl_minor, currency)],
                ['Link CTR', formatPercent(drawer.link_ctr)],
                ['CPC', formatMinor(drawer.cpc_minor, currency)],
                ['Impressions', formatCount(drawer.impressions)],
                ['Reach', formatCount(drawer.reach)],
                ['Frequency', formatFrequency(drawer.frequency)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt style={{ fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: brand.textMuted }}>{label}</dt>
                  <dd style={{ margin: '4px 0 0', fontFamily: fonts.display, fontSize: 20 }}>{value}</dd>
                </div>
              ))}
            </dl>
            {drawer.level !== 'ad' && (
              <button type="button" onClick={() => goDeeper(drawer)} style={{ ...controlStyle, cursor: 'pointer', background: brand.gold, color: brand.dark, fontFamily: fonts.display, fontWeight: 700 }}>
                {drawer.level === 'campaign' ? 'View ad sets' : 'View ads'}
              </button>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
