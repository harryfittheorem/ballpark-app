/**
 * Maps the read-only contract rows into cohort facts.
 * Rows that are not contract_ready are ignored. Gross alone is never net.
 */
import { formatDateInTimeZone } from '../metrics';
import type {
  AcquisitionExpenseInput,
  CohortFacts,
  EconomicsLead,
  EconomicsReceipt,
  ExpenseCategory,
  ExpenseChannel,
  LeadChannel,
  ReceiptKind,
} from './types';

export interface OriginContractRow {
  lead_id: string;
  location_id: string;
  created_at: string | null;
  facility_tz: string | null;
  channel: string | null;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  meta_ad_id: string | null;
  family_id: string | null;
  is_reactivation: boolean | null;
  contract_ready: boolean;
}

export interface ReceiptContractRow {
  receipt_id: string;
  family_id: string;
  location_id: string | null;
  kind: string | null;
  gross_cents: number | null;
  tax_cents: number | null;
  net_cents: number | null;
  currency: string | null;
  cash_at: string | null;
  contract_ready: boolean;
}

const CHANNELS = new Set<LeadChannel>(['meta_form', 'web', 'phone', 'walk_in', 'referral', 'organic', 'unknown']);
const KINDS = new Set<ReceiptKind>(['payment', 'refund', 'chargeback', 'recovery']);
const CATEGORIES = new Set<ExpenseCategory>([
  'media', 'agency_retainer', 'performance_fee', 'production', 'freelance', 'software', 'sales_labor', 'other',
]);
const EXPENSE_CHANNELS = new Set<ExpenseChannel>(['meta', 'organic', 'referral', 'other']);

function asChannel(value: string | null): LeadChannel | null {
  return value !== null && CHANNELS.has(value as LeadChannel) ? value as LeadChannel : null;
}

function localDay(iso: string | null, timeZone: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatDateInTimeZone(parsed, timeZone || 'UTC');
}

export function mapOriginRow(row: OriginContractRow): EconomicsLead | null {
  if (!row.contract_ready) return null;
  return {
    leadId: row.lead_id,
    locationId: row.location_id,
    createdOn: localDay(row.created_at, row.facility_tz),
    channel: asChannel(row.channel),
    metaCampaignId: row.meta_campaign_id,
    metaAdsetId: row.meta_adset_id,
    metaAdId: row.meta_ad_id,
    familyId: row.family_id,
    isReactivation: row.is_reactivation,
    evaluationBooked: null,
    evaluationAttended: null,
  };
}

export function mapReceiptRow(row: ReceiptContractRow): EconomicsReceipt | null {
  if (!row.contract_ready || row.net_cents === null || row.currency === null || row.cash_at === null) return null;
  if (row.kind === null || !KINDS.has(row.kind as ReceiptKind)) return null;
  return {
    receiptId: row.receipt_id,
    familyId: row.family_id,
    locationId: row.location_id,
    kind: row.kind as ReceiptKind,
    grossCents: row.gross_cents,
    taxCents: row.tax_cents,
    netCents: row.net_cents,
    currency: row.currency,
    cashOn: localDay(row.cash_at, 'UTC'),
  };
}

export function mapExpenseRow(row: {
  id: string;
  category: string;
  amount_cents: number;
  currency: string;
  cadence: string;
  service_start: string;
  service_end: string;
  meta_campaign_id: string | null;
  channel: string | null;
}): AcquisitionExpenseInput | null {
  if (!CATEGORIES.has(row.category as ExpenseCategory)) return null;
  if (row.cadence !== 'one_time' && row.cadence !== 'recurring_monthly') return null;
  return {
    id: row.id,
    category: row.category as ExpenseCategory,
    amountCents: row.amount_cents,
    currency: row.currency,
    cadence: row.cadence,
    serviceStart: row.service_start,
    serviceEnd: row.service_end,
    metaCampaignId: row.meta_campaign_id,
    channel: row.channel !== null && EXPENSE_CHANNELS.has(row.channel as ExpenseChannel) ? row.channel as ExpenseChannel : null,
  };
}

export function factsFromContract(input: {
  locationId: string;
  locationLabel: string;
  cohortLabel: string;
  cohortFrom: string;
  cohortTo: string;
  asOf: string;
  origins: OriginContractRow[];
  receipts: ReceiptContractRow[];
  expenses: AcquisitionExpenseInput[];
  expensesReviewed: boolean;
}): CohortFacts {
  const leads = input.origins.map(mapOriginRow).filter((lead): lead is EconomicsLead => lead !== null);
  const receipts = input.receipts.map(mapReceiptRow).filter((receipt): receipt is EconomicsReceipt => receipt !== null);
  const currencies = [...new Set(receipts.map((receipt) => receipt.currency).filter((currency): currency is string => Boolean(currency)))];
  return {
    mode: 'live',
    locationId: input.locationId,
    locationLabel: input.locationLabel,
    cohortLabel: input.cohortLabel,
    cohortFrom: input.cohortFrom,
    cohortTo: input.cohortTo,
    asOf: input.asOf,
    currency: currencies.length === 1 ? currencies[0] : null,
    leadsConnected: true,
    receiptsConnected: true,
    mediaConnected: false,
    expensesConnected: true,
    expensesReviewed: input.expensesReviewed,
    directCostsConnected: false,
    leads,
    receipts,
    media: [],
    expenses: input.expenses,
    directCosts: { d30: null, d90: null, realized: null },
  };
}
