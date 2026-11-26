/**
 * July 2026 paid-Meta cohort from the marketing package.
 * Built from leads and cash movements, not from the headline totals.
 * Sample data only. Never mixed into a connected location.
 */
import { addIsoDays } from '../metrics';
import type { CohortFacts, EconomicsLead, EconomicsReceipt } from './types';

export const SAMPLE_LOCATION_ID = 'sample-frisco';
export const SAMPLE_LOCATION_LABEL = 'Frisco Academy';
export const SAMPLE_COHORT_LABEL = 'July 2026';
export const SAMPLE_LEAD_ON = '2026-07-15';
export const SAMPLE_AS_OF = '2026-11-25';
export const SAMPLE_FEE_CENTS = 100_000;

const EVAL = 'cmp_eval';
const SUMMER = 'cmp_summer';

function stage(index: number): { campaign: string; payer: boolean; booked: boolean; attended: boolean } {
  if (index < 60) {
    return {
      campaign: EVAL,
      payer: index < 13,
      attended: index < 22,
      booked: index < 30,
    };
  }
  const local = index - 60;
  return {
    campaign: SUMMER,
    payer: local < 7,
    attended: local < 13,
    booked: local < 20,
  };
}

export function sampleCohortFacts(feeCents: number | null = SAMPLE_FEE_CENTS): CohortFacts {
  const leads: EconomicsLead[] = [];
  const receipts: EconomicsReceipt[] = [];
  let familyNumber = 0;
  for (let index = 0; index < 100; index += 1) {
    const stageFlags = stage(index);
    const familyId = stageFlags.payer ? `family-${String(++familyNumber).padStart(2, '0')}` : null;
    leads.push({
      leadId: `lead-${String(index + 1).padStart(3, '0')}`,
      locationId: SAMPLE_LOCATION_ID,
      createdOn: SAMPLE_LEAD_ON,
      channel: 'meta_form',
      metaCampaignId: stageFlags.campaign,
      metaAdsetId: null,
      metaAdId: null,
      familyId,
      isReactivation: false,
      evaluationBooked: stageFlags.booked,
      evaluationAttended: stageFlags.attended,
    });
    if (!familyId) continue;
    const payments = [
      { age: 5, cents: 30_000 },
      { age: 48, cents: 20_000 },
      { age: 92, cents: 10_000 },
    ];
    payments.forEach((payment, paymentIndex) => {
      receipts.push({
        receiptId: `${familyId}-${paymentIndex}`,
        familyId,
        locationId: SAMPLE_LOCATION_ID,
        kind: 'payment',
        grossCents: payment.cents,
        taxCents: 0,
        netCents: payment.cents,
        currency: 'USD',
        cashOn: addIsoDays(SAMPLE_LEAD_ON, payment.age),
      });
    });
  }

  return {
    mode: 'sample',
    locationId: SAMPLE_LOCATION_ID,
    locationLabel: SAMPLE_LOCATION_LABEL,
    cohortLabel: SAMPLE_COHORT_LABEL,
    cohortFrom: '2026-07-01',
    cohortTo: '2026-07-31',
    asOf: SAMPLE_AS_OF,
    currency: 'USD',
    leadsConnected: true,
    receiptsConnected: true,
    mediaConnected: true,
    expensesConnected: true,
    expensesReviewed: true,
    directCostsConnected: true,
    leads,
    receipts,
    media: [
      { metaCampaignId: EVAL, campaignName: 'Evaluation bookings', spendCents: 180_000, currency: 'USD' },
      { metaCampaignId: SUMMER, campaignName: 'Summer skills', spendCents: 120_000, currency: 'USD' },
    ],
    expenses: [
      {
        id: 'fee-july',
        category: 'agency_retainer',
        amountCents: feeCents,
        currency: 'USD',
        cadence: 'one_time',
        serviceStart: '2026-07-01',
        serviceEnd: '2026-07-31',
        metaCampaignId: null,
        channel: 'meta',
      },
    ],
    directCosts: { d30: 180_000, d90: 300_000, realized: 360_000 },
  };
}

export function disconnectedFacts(): CohortFacts {
  return {
    mode: 'live',
    locationId: null,
    locationLabel: 'This location',
    cohortLabel: 'Selected cohort',
    cohortFrom: null,
    cohortTo: null,
    asOf: null,
    currency: null,
    leadsConnected: false,
    receiptsConnected: false,
    mediaConnected: false,
    expensesConnected: false,
    expensesReviewed: false,
    directCostsConnected: false,
    leads: [],
    receipts: [],
    media: [],
    expenses: [],
    directCosts: { d30: null, d90: null, realized: null },
  };
}
