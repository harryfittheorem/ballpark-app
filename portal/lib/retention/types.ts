/** Reporting contracts only; no default business policy is approved in code. */
export type RetentionPolicy = {
  version: string;
  effectiveFrom: string;
  approvalReference: string;
  entity: 'player';
  loss: 'absent_at_close';
  pauses: 'retained' | 'excluded';
  expiry: 'expires_at';
  reactivation: 'retained_at_close';
  transfer: 'opening_location';
  location: 'family_primary_at_open';
  cancellationDate: 'cancel_effective_at_then_cancelled_at';
  timezone: 'location';
  segments: 'recorded_at_open';
  tenure: 'current_spell_elapsed_days';
  privacy: 'owner_names_network_aggregate';
};

export type MembershipEvidence = {
  id: string;
  tenant_id: string;
  membership_id: string;
  kid_id: string;
  effective_at: string;
  recorded_at: string;
  source: string;
  state: {
    status: string;
    started_at?: string | null;
    cancelled_at?: string | null;
    cancel_effective_at?: string | null;
    expires_at?: string | null;
    deleted?: boolean;
  };
};
export type SegmentEvidence = {
  id: string;
  tenant_id: string;
  kid_id: string;
  location_id: string | null;
  effective_at: string;
  recorded_at: string;
  source: string;
  state: {
    division?: string | null;
    sport?: string | null;
    gender?: string | null;
    competition?: string | null;
  };
};
export type RetentionLocation = { id: string; tenant_id: string; name: string; timezone: string };
export type PauseAnalytics = {
  totalEverPaused: number;
  avgTenureBeforePauseDays: number | null;
  pauseToCancelRate: number | null;
  reactivationRate: number | null;
  currentlyPaused: number;
};

export type RetentionDataset = {
  scope: 'owner' | 'network';
  locations: RetentionLocation[];
  memberships: MembershipEvidence[];
  segments: SegmentEvidence[];
  coverage: Array<{ tenant_id: string; started_at: string }>;
  policies: Array<{ tenant_id: string; policy: RetentionPolicy }>;
  names: Record<string, string>;
  issues: string[];
  /** Finance/R06 adapters stay unavailable until their approved contracts exist. */
  finance: { available: false; reason: string };
  instructors: { available: false; reason: string };
  asOf: string;
  pauseAnalytics: PauseAnalytics | null;
};
export type RetentionFilters = {
  startMonth: string;
  endMonth: string;
  locationId?: string;
  division?: string;
  sport?: string;
  gender?: string;
  competition?: string;
};
export type RetentionLoss = {
  key: string;
  month: string;
  tenantId: string;
  kidId: string;
  name: string | null;
  locationId: string;
  effectiveAt: string;
  reason: 'cancellation' | 'nonrenewal';
  evidenceIds: string[];
};
export type RetentionRow = {
  month: string;
  opening: number | null;
  losses: number | null;
  retained: number | null;
  churnRate: number | null;
  retentionRate: number | null;
  unavailable: string[];
};
export type RetentionReport = RetentionRow & {
  months: RetentionRow[];
  lostPlayers: RetentionLoss[];
  tenure: Array<{ label: string; opening: number; losses: number; churnRate: number | null }>;
  divisions: Array<{ label: string; opening: number; losses: number; churnRate: number | null }>;
  unit: string;
};
