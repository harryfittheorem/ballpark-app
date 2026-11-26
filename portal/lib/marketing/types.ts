/** Shared marketing report contract. Safe to import from client components. */

export const ATTRIBUTION_WINDOWS = ['7d_click', '1d_view'] as const;
export const ATTRIBUTION_LABEL = '7-day click, 1-day view';
export const SAMPLE_LABEL = 'Sample data, not provider-verified';

/** Current Marketing API version as of the Nov 4, 2026 release. Override with META_GRAPH_API_VERSION. */
export const DEFAULT_GRAPH_API_VERSION = 'v27.0';

export type ReportingMode = 'sample' | 'live';
export type LocationConnection = 'connected' | 'not_connected' | 'sample';
export type EntityLevel = 'campaign' | 'adset' | 'ad';

export interface MetricBlock {
  spend_minor: number | null;
  impressions: number | null;
  inline_link_clicks: number | null;
  leads: number | null;
  reach: number | null;
  frequency: number | null;
  /** inline_link_clicks / impressions. Null when either input is null or impressions are 0. */
  link_ctr: number | null;
  /** spend_minor / inline_link_clicks. Null when either input is null or clicks are 0. */
  cpc_minor: number | null;
  /** spend_minor / leads. Null when either input is null or leads are 0. */
  cpl_minor: number | null;
}

export interface DailyPoint extends MetricBlock {
  date: string;
}

export interface EntityRow extends MetricBlock {
  id: string;
  name: string;
  level: EntityLevel;
  parent_id: string | null;
}

export interface MarketingLocation {
  id: string;
  name: string;
  /** Null in sample mode so a fixture is never paired with a real ad account id. */
  ad_account_id: string | null;
  connection: LocationConnection;
}

export interface MarketingMetaResponse {
  mode: ReportingMode;
  location_id: string | null;
  locations: MarketingLocation[];
  connection: LocationConnection;
  ad_account_id: string | null;
  ad_account_label: string;
  window: { from: string; to: string };
  /** Yesterday in the ad account timezone. Null when the timezone is unknown. */
  last_complete_date: string | null;
  /** True when the requested `to` date is after the last complete account day. */
  window_includes_open_day: boolean;
  fetched_at: string;
  /** True when a Graph cursor remained after the page cap. Totals may be short. */
  incomplete: boolean;
  currency: string | null;
  timezone: string | null;
  /** Null when the timezone was missing and a preset fell back to UTC. */
  timezone_note: string | null;
  attribution: string[];
  attribution_label: string;
  /** Null in sample mode. Live responses name the version that was called. */
  graph_version: string | null;
  summary: MetricBlock | null;
  daily: DailyPoint[];
  entities: EntityRow[];
  entity_level: EntityLevel;
  config_error: string | null;
  shared_account: boolean;
  note: string | null;
}
