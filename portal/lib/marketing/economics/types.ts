/**
 * Read-only acquisition economics. Amounts are integer minor units.
 * Null means the source is missing or the ratio is undefined. It is not zero.
 */

export type Horizon = 'd30' | 'd90' | 'realized';
export type EconomicsSource = 'meta' | 'organic' | 'referral' | 'unknown' | 'all';
export type LeadChannel = 'meta_form' | 'web' | 'phone' | 'walk_in' | 'referral' | 'organic' | 'unknown';
export type ReceiptKind = 'payment' | 'refund' | 'chargeback' | 'recovery';
export type ExpenseCategory =
  | 'media'
  | 'agency_retainer'
  | 'performance_fee'
  | 'production'
  | 'freelance'
  | 'software'
  | 'sales_labor'
  | 'other';
export type ExpenseChannel = 'meta' | 'organic' | 'referral' | 'other';

export interface EconomicsLead {
  leadId: string;
  locationId: string;
  /** Facility-local first-inquiry date. Null when CRM has not stored one. */
  createdOn: string | null;
  channel: LeadChannel | null;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  metaAdId: string | null;
  /** Set only for a staff-verified family link. */
  familyId: string | null;
  isReactivation: boolean | null;
  evaluationBooked: boolean | null;
  evaluationAttended: boolean | null;
}

export interface EconomicsReceipt {
  receiptId: string;
  familyId: string;
  locationId: string | null;
  kind: ReceiptKind | null;
  grossCents: number | null;
  taxCents: number | null;
  /** Signed net of tax. Null when tax or the cash amount is unknown. */
  netCents: number | null;
  currency: string | null;
  /** Facility-local cash date. Null when only a webhook arrival time exists. */
  cashOn: string | null;
}

export interface AcquisitionExpenseInput {
  id: string;
  category: ExpenseCategory;
  amountCents: number | null;
  currency: string | null;
  cadence: 'one_time' | 'recurring_monthly';
  serviceStart: string;
  serviceEnd: string;
  /** Null spends the cost across campaigns in proportion to media spend. */
  metaCampaignId: string | null;
  channel: ExpenseChannel | null;
}

export interface MediaSpendInput {
  metaCampaignId: string | null;
  campaignName: string;
  spendCents: number | null;
  currency: string | null;
}

export interface CohortFacts {
  mode: 'sample' | 'live';
  locationId: string | null;
  locationLabel: string;
  cohortLabel: string;
  cohortFrom: string | null;
  cohortTo: string | null;
  asOf: string | null;
  currency: string | null;
  leadsConnected: boolean;
  receiptsConnected: boolean;
  mediaConnected: boolean;
  expensesConnected: boolean;
  /** False when no approved acquisition expense exists. Unknown is not zero. */
  expensesReviewed: boolean;
  directCostsConnected: boolean;
  leads: EconomicsLead[];
  receipts: EconomicsReceipt[];
  media: MediaSpendInput[];
  expenses: AcquisitionExpenseInput[];
  directCosts: Record<Horizon, number | null>;
}

export interface CampaignEconomics {
  id: string | null;
  name: string;
  mediaSpendCents: number | null;
  feeCents: number | null;
  acquisitionCostCents: number | null;
  leads: number | null;
  acquiredFamilies: number | null;
  netCollectionsCents: number | null;
  mediaRoas: number | null;
  cacCents: number | null;
}

export type Payback =
  | { status: 'recovered'; ageDays: number }
  | { status: 'not_yet' }
  | { status: 'insufficient_history' }
  | { status: 'unavailable' };

export interface CohortEvaluation {
  horizon: Horizon;
  mature: boolean;
  currency: string | null;
  mediaSpendCents: number | null;
  feeCents: number | null;
  unallocatedFeeCents: number | null;
  acquisitionCostCents: number | null;
  leadCount: number | null;
  reactivations: number | null;
  acquiredFamilies: number | null;
  netCollectionsCents: number | null;
  directCostCents: number | null;
  grossProfitCents: number | null;
  mediaCplCents: number | null;
  cacCents: number | null;
  mediaRoas: number | null;
  allInReturn: number | null;
  ltgpPerFamilyCents: number | null;
  ltgpToCac: number | null;
  contributionCents: number | null;
  roi: number | null;
  payback: Payback;
  costPerAttendedCents: number | null;
  funnel: {
    leads: number | null;
    evaluationsBooked: number | null;
    evaluationsAttended: number | null;
    payers: number | null;
    leadToPaid: number | null;
  };
  /** Acquired families whose winning lead has an ad id, over acquired families. */
  adLevelCoverage: number | null;
  adLevelLabeled: string;
  campaigns: CampaignEconomics[];
  unallocated: CampaignEconomics;
  notes: string[];
}

export interface EconomicsView {
  mode: 'sample' | 'live';
  locationLabel: string;
  cohortLabel: string;
  asOf: string | null;
  currency: string | null;
  source: EconomicsSource;
  horizon: Horizon;
  selected: CohortEvaluation;
  horizons: Record<Horizon, CohortEvaluation>;
}
