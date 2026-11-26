/**
 * Cohort profitability in integer minor units.
 * Ratios are recomputed from summed numerators and denominators.
 * A missing source stays null. A verified zero stays zero.
 * Retainers split across the real length of each month, not a 30-day month.
 * Marketing ROI is (gross profit − acquisition cost) / acquisition cost,
 * not (revenue − cost) / cost.
 */
import { addIsoDays, eachIsoDate, ratioFromSums } from '../metrics';
import type {
  AcquisitionExpenseInput,
  CampaignEconomics,
  CohortEvaluation,
  CohortFacts,
  EconomicsLead,
  EconomicsReceipt,
  EconomicsSource,
  Horizon,
  MediaSpendInput,
  Payback,
} from './types';

const HORIZONS: Horizon[] = ['d30', 'd90', 'realized'];

export function daysAfter(start: string, day: string): number {
  const ms = Date.parse(`${day}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Largest-remainder split. The earliest indexes receive leftover cents. */
export function distributeCents(total: number, weights: number[]): number[] | null {
  if (!Number.isSafeInteger(total) || total < 0) return null;
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) return null;
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum === 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((left, right) => (right.frac - left.frac) || (left.index - right.index));
  const shares = floors.slice();
  for (let cursor = 0; cursor < order.length && remainder > 0; cursor += 1) {
    shares[order[cursor].index] += 1;
    remainder -= 1;
  }
  return shares;
}

function rangesOverlap(start: string, end: string, otherStart: string, otherEnd: string): boolean {
  return start <= otherEnd && otherStart <= end;
}

export function expenseCentsInWindow(
  expense: AcquisitionExpenseInput,
  windowFrom: string,
  windowTo: string,
): number | null {
  if (expense.amountCents === null || !Number.isSafeInteger(expense.amountCents) || expense.amountCents < 0) {
    return null;
  }
  if (expense.serviceStart > expense.serviceEnd || windowFrom > windowTo) return null;
  if (expense.cadence === 'one_time') {
    const days = eachIsoDate(expense.serviceStart, expense.serviceEnd);
    const shares = distributeCents(expense.amountCents, days.map(() => 1));
    if (!shares) return null;
    return days.reduce((total, day, index) => (
      day >= windowFrom && day <= windowTo ? total + shares[index] : total
    ), 0);
  }
  let total = 0;
  let year = Number(expense.serviceStart.slice(0, 4));
  let month = Number(expense.serviceStart.slice(5, 7));
  const lastKey = expense.serviceEnd.slice(0, 7);
  while (`${year}-${String(month).padStart(2, '0')}` <= lastKey) {
    const count = daysInMonth(year, month);
    const shares = distributeCents(expense.amountCents, Array.from({ length: count }, () => 1));
    if (!shares) return null;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    for (let index = 0; index < count; index += 1) {
      const day = addIsoDays(monthStart, index);
      if (day < expense.serviceStart || day > expense.serviceEnd) continue;
      if (day < windowFrom || day > windowTo) continue;
      total += shares[index];
    }
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return total;
}

function expenseKey(expense: AcquisitionExpenseInput): string {
  return `${expense.category}:${expense.metaCampaignId ?? ''}:${expense.channel ?? ''}`;
}

export function summedExpenseCents(
  expenses: AcquisitionExpenseInput[],
  windowFrom: string,
  windowTo: string,
  currency: string | null,
): number | null {
  const groups = new Map<string, AcquisitionExpenseInput[]>();
  for (const expense of expenses) {
    if (expense.currency === null || (currency && expense.currency !== currency)) return null;
    const list = groups.get(expenseKey(expense)) ?? [];
    list.push(expense);
    groups.set(expenseKey(expense), list);
  }
  for (const list of groups.values()) {
    const ordered = [...list].sort((left, right) => left.serviceStart.localeCompare(right.serviceStart));
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      if (rangesOverlap(previous.serviceStart, previous.serviceEnd, current.serviceStart, current.serviceEnd)) {
        return null;
      }
    }
  }
  let total = 0;
  for (const expense of expenses) {
    const part = expenseCentsInWindow(expense, windowFrom, windowTo);
    if (part === null) return null;
    total += part;
  }
  return total;
}

/** Signed net of tax. A supplied netCents is already signed. Gross is never used alone. */
export function receiptNetCents(receipt: EconomicsReceipt): number | null {
  if (receipt.kind !== 'payment' && receipt.kind !== 'refund' && receipt.kind !== 'chargeback' && receipt.kind !== 'recovery') {
    return null;
  }
  if (receipt.netCents !== null) return receipt.netCents;
  if (receipt.grossCents === null || receipt.taxCents === null) return null;
  const net = receipt.grossCents - receipt.taxCents;
  if (receipt.kind === 'refund' || receipt.kind === 'chargeback') return -Math.abs(net);
  return net;
}

function channelMatches(channel: EconomicsLead['channel'], source: EconomicsSource): boolean {
  if (source === 'all') return true;
  if (source === 'meta') return channel === 'meta_form';
  if (source === 'organic') return channel === 'organic';
  if (source === 'referral') return channel === 'referral';
  return channel === null || channel === 'unknown';
}

function expenseMatches(channel: AcquisitionExpenseInput['channel'], source: EconomicsSource): boolean {
  if (source === 'all' || channel === null) return true;
  if (source === 'meta') return channel === 'meta';
  if (source === 'organic') return channel === 'organic';
  if (source === 'referral') return channel === 'referral';
  return channel === 'other';
}

function emptyCampaign(id: string | null, name: string): CampaignEconomics {
  return {
    id,
    name,
    mediaSpendCents: 0,
    feeCents: 0,
    acquisitionCostCents: 0,
    leads: 0,
    acquiredFamilies: 0,
    netCollectionsCents: 0,
    mediaRoas: null,
    cacCents: null,
  };
}

function unavailableCampaign(id: string | null, name: string): CampaignEconomics {
  return {
    id,
    name,
    mediaSpendCents: null,
    feeCents: null,
    acquisitionCostCents: null,
    leads: null,
    acquiredFamilies: null,
    netCollectionsCents: null,
    mediaRoas: null,
    cacCents: null,
  };
}

function ageLimit(horizon: Horizon): number | null {
  if (horizon === 'd30') return 29;
  if (horizon === 'd90') return 89;
  return null;
}

function countFlag(leads: EconomicsLead[], flag: 'evaluationBooked' | 'evaluationAttended'): number | null {
  if (leads.some((lead) => lead[flag] === null)) return null;
  return leads.filter((lead) => lead[flag] === true).length;
}

interface FamilyCash {
  netCents: number | null;
  outsideLocation: boolean;
}

function familyCash(
  facts: CohortFacts,
  familyId: string,
  leadOn: string,
  maxAge: number | null,
): FamilyCash {
  if (!facts.receiptsConnected || !facts.asOf) return { netCents: null, outsideLocation: false };
  let total = 0;
  let outside = false;
  const seen = new Set<string>();
  for (const receipt of facts.receipts) {
    if (receipt.familyId !== familyId) continue;
    if (seen.has(receipt.receiptId)) continue;
    seen.add(receipt.receiptId);
    if (receipt.locationId === null || receipt.cashOn === null || receipt.currency === null) {
      return { netCents: null, outsideLocation: outside };
    }
    if (facts.currency && receipt.currency !== facts.currency) return { netCents: null, outsideLocation: outside };
    if (facts.locationId && receipt.locationId !== facts.locationId) {
      const age = daysAfter(leadOn, receipt.cashOn);
      if (age >= 0 && receipt.cashOn <= facts.asOf && (maxAge === null || age <= maxAge)) outside = true;
      continue;
    }
    const age = daysAfter(leadOn, receipt.cashOn);
    if (age < 0 || receipt.cashOn > facts.asOf) continue;
    if (maxAge !== null && age > maxAge) continue;
    const net = receiptNetCents(receipt);
    if (net === null) return { netCents: null, outsideLocation: outside };
    total += net;
  }
  if (outside) return { netCents: null, outsideLocation: true };
  return { netCents: total, outsideLocation: false };
}

function mediaRowsForSource(facts: CohortFacts, source: EconomicsSource): MediaSpendInput[] | null {
  if (source !== 'meta' && source !== 'all') return [];
  if (facts.mediaConnected) return facts.media;
  const manual = facts.expenses.filter((expense) => (
    expense.category === 'media' && expenseMatches(expense.channel, source)
  ));
  if (!facts.expensesConnected || !facts.expensesReviewed || manual.length === 0 || !facts.cohortFrom || !facts.cohortTo) {
    return null;
  }
  const grouped = new Map<string, MediaSpendInput>();
  for (const expense of manual) {
    const spend = expenseCentsInWindow(expense, facts.cohortFrom, facts.cohortTo);
    if (spend === null || expense.currency === null) return null;
    const key = expense.metaCampaignId ?? '';
    const current = grouped.get(key) ?? {
      metaCampaignId: expense.metaCampaignId,
      campaignName: expense.metaCampaignId ?? 'Unallocated',
      spendCents: 0,
      currency: expense.currency,
    };
    current.spendCents = (current.spendCents ?? 0) + spend;
    grouped.set(key, current);
  }
  return [...grouped.values()];
}

function blankEvaluation(facts: CohortFacts, horizon: Horizon, notes: string[]): CohortEvaluation {
  return {
    horizon,
    mature: false,
    currency: facts.currency,
    mediaSpendCents: null,
    feeCents: null,
    unallocatedFeeCents: null,
    acquisitionCostCents: null,
    leadCount: null,
    reactivations: null,
    acquiredFamilies: null,
    netCollectionsCents: null,
    directCostCents: null,
    grossProfitCents: null,
    mediaCplCents: null,
    cacCents: null,
    mediaRoas: null,
    allInReturn: null,
    ltgpPerFamilyCents: null,
    ltgpToCac: null,
    contributionCents: null,
    roi: null,
    payback: { status: 'unavailable' },
    costPerAttendedCents: null,
    funnel: { leads: null, evaluationsBooked: null, evaluationsAttended: null, payers: null, leadToPaid: null },
    adLevelCoverage: null,
    adLevelLabeled: 'unavailable',
    campaigns: [],
    unallocated: unavailableCampaign(null, 'Unallocated'),
    notes,
  };
}

export function evaluateCohort(
  facts: CohortFacts,
  source: EconomicsSource,
  horizon: Horizon,
): CohortEvaluation {
  const notes: string[] = [];
  if (!facts.leadsConnected) notes.push('CRM lead origin is not connected.');
  if (!facts.receiptsConnected) notes.push('Collected cash is not connected.');
  if (!facts.mediaConnected && source !== 'organic' && source !== 'referral' && source !== 'unknown') {
    notes.push('Meta spend is not connected.');
  }
  if (!facts.expensesConnected) notes.push('Acquisition expenses are not connected.');
  else if (!facts.expensesReviewed) notes.push('Acquisition expenses have no approved rows. All-in figures stay unavailable.');
  if (!facts.directCostsConnected) notes.push('Direct delivery cost is not connected. Gross profit stays unavailable.');

  if (!facts.leadsConnected || !facts.cohortFrom || !facts.cohortTo || !facts.asOf || !facts.currency) {
    return blankEvaluation(facts, horizon, notes);
  }

  const seen = new Set<string>();
  const located: EconomicsLead[] = [];
  let undated = 0;
  for (const lead of facts.leads) {
    if (facts.locationId && lead.locationId !== facts.locationId) continue;
    if (seen.has(lead.leadId)) continue;
    seen.add(lead.leadId);
    if (!channelMatches(lead.channel, source)) continue;
    if (!lead.createdOn) {
      undated += 1;
      continue;
    }
    if (lead.createdOn < facts.cohortFrom || lead.createdOn > facts.cohortTo) continue;
    located.push(lead);
  }
  if (undated > 0) notes.push(`${undated} inquiries have no first-inquiry date and are left out of this cohort.`);

  const limit = ageLimit(horizon);
  const mature = limit === null || located.every((lead) => daysAfter(lead.createdOn as string, facts.asOf as string) >= limit);
  if (!mature) notes.push('This horizon is not mature for every lead in the cohort.');

  const leadCount = located.length;
  const reactivations = located.filter((lead) => lead.isReactivation === true).length;
  const booked = countFlag(located, 'evaluationBooked');
  const attended = countFlag(located, 'evaluationAttended');
  const winners = new Map<string, EconomicsLead>();
  const ordered = located
    .filter((lead) => lead.familyId && lead.isReactivation !== true)
    .sort((left, right) => (left.createdOn as string).localeCompare(right.createdOn as string) || left.leadId.localeCompare(right.leadId));
  for (const lead of ordered) {
    if (!winners.has(lead.familyId as string)) winners.set(lead.familyId as string, lead);
  }

  const mediaRows = mediaRowsForSource(facts, source);
  const mediaKnown = mediaRows !== null && mediaRows.every((row) => (
    row.spendCents !== null && row.currency === facts.currency
  ));
  const mediaSpendCents = mediaKnown
    ? (mediaRows as MediaSpendInput[]).reduce((total, row) => total + (row.spendCents as number), 0)
    : null;
  if (facts.mediaConnected && mediaRows?.some((row) => row.spendCents === null)) {
    notes.push('A media row is missing spend, so spend is unavailable.');
  }

  const feeExpenses = facts.expenses.filter((expense) => (
    expense.category !== 'media' && expenseMatches(expense.channel, source)
  ));
  const feesKnown = facts.expensesConnected && facts.expensesReviewed;
  const pinned = new Map<string, number | null>();
  let floating: number | null = feesKnown ? 0 : null;
  if (feesKnown) {
    for (const expense of feeExpenses) {
      const cents = expenseCentsInWindow(expense, facts.cohortFrom, facts.cohortTo);
      if (cents === null || expense.currency !== facts.currency) {
        floating = null;
        break;
      }
      if (expense.metaCampaignId) {
        const current = pinned.get(expense.metaCampaignId);
        pinned.set(expense.metaCampaignId, current === undefined ? cents : (current === null ? null : current + cents));
      } else if (floating !== null) {
        floating += cents;
      }
    }
    const grouped = new Map<string, AcquisitionExpenseInput[]>();
    for (const expense of feeExpenses) {
      const list = grouped.get(expenseKey(expense)) ?? [];
      list.push(expense);
      grouped.set(expenseKey(expense), list);
    }
    for (const list of grouped.values()) {
      const orderedFees = [...list].sort((left, right) => left.serviceStart.localeCompare(right.serviceStart));
      for (let index = 1; index < orderedFees.length; index += 1) {
        const previous = orderedFees[index - 1];
        const current = orderedFees[index];
        if (rangesOverlap(previous.serviceStart, previous.serviceEnd, current.serviceStart, current.serviceEnd)) {
          floating = null;
          notes.push('Overlapping acquisition expenses make the fee unavailable.');
        }
      }
    }
  }
  if (facts.mediaConnected && facts.expenses.some((expense) => expense.category === 'media' && expenseMatches(expense.channel, source))) {
    notes.push('A media invoice is not added on top of Meta spend.');
  }

  const buckets = new Map<string, CampaignEconomics>();
  const unallocated = emptyCampaign(null, 'Unallocated');
  if (mediaKnown) {
    for (const row of mediaRows as MediaSpendInput[]) {
      const bucket = row.metaCampaignId
        ? emptyCampaign(row.metaCampaignId, row.campaignName)
        : unallocated;
      bucket.mediaSpendCents = row.spendCents;
      if (row.metaCampaignId) buckets.set(row.metaCampaignId, bucket);
    }
  } else {
    unallocated.mediaSpendCents = null;
    unallocated.feeCents = null;
    unallocated.acquisitionCostCents = null;
    unallocated.leads = null;
    unallocated.acquiredFamilies = null;
    unallocated.netCollectionsCents = null;
  }

  function bucketFor(campaignId: string | null, name: string): CampaignEconomics {
    if (!campaignId) return unallocated;
    const existing = buckets.get(campaignId);
    if (existing) return existing;
    const created = emptyCampaign(campaignId, name);
    if (!mediaKnown) {
      created.mediaSpendCents = null;
      created.feeCents = null;
      created.acquisitionCostCents = null;
      created.netCollectionsCents = null;
    }
    buckets.set(campaignId, created);
    return created;
  }

  if (mediaKnown) {
    for (const lead of located) bucketFor(lead.metaCampaignId, lead.metaCampaignId ?? 'Unallocated').leads = 0;
    for (const lead of located) {
      const bucket = bucketFor(lead.metaCampaignId, lead.metaCampaignId ?? 'Unallocated');
      bucket.leads = (bucket.leads ?? 0) + 1;
    }
  }

  const weights: Array<{ id: string | null; spend: number }> = [];
  if (mediaKnown) {
    for (const bucket of buckets.values()) weights.push({ id: bucket.id, spend: bucket.mediaSpendCents ?? 0 });
    if ((unallocated.mediaSpendCents ?? 0) > 0 || weights.length === 0) {
      weights.push({ id: null, spend: unallocated.mediaSpendCents ?? 0 });
    }
  }
  const weightSum = weights.reduce((total, row) => total + row.spend, 0);
  if (floating !== null && mediaKnown) {
    if (weightSum === 0) {
      unallocated.feeCents = (unallocated.feeCents ?? 0) + floating;
      if (!weights.some((row) => row.id === null)) weights.push({ id: null, spend: 0 });
    } else {
      const shares = distributeCents(floating, weights.map((row) => row.spend));
      if (!shares) floating = null;
      else {
        shares.forEach((share, index) => {
          const target = weights[index].id ? buckets.get(weights[index].id as string) : unallocated;
          if (!target) return;
          target.feeCents = (target.feeCents ?? 0) + share;
        });
      }
    }
  }
  if (floating !== null && mediaKnown) {
    for (const [campaignId, amount] of pinned) {
      if (amount === null) continue;
      const target = bucketFor(campaignId, campaignId);
      target.feeCents = (target.feeCents ?? 0) + amount;
    }
  }
  if (floating === null) {
    for (const bucket of buckets.values()) bucket.feeCents = null;
    unallocated.feeCents = null;
  }

  let netCollectionsCents: number | null = facts.receiptsConnected && mature ? 0 : null;
  let outside = false;
  const familyNets = new Map<string, number | null>();
  if (facts.receiptsConnected && mature) {
    for (const [familyId, lead] of winners) {
      const cash = familyCash(facts, familyId, lead.createdOn as string, limit);
      familyNets.set(familyId, cash.netCents);
      if (cash.outsideLocation) outside = true;
      if (cash.netCents === null) netCollectionsCents = null;
      else if (netCollectionsCents !== null) netCollectionsCents += cash.netCents;
    }
  }
  if (outside) notes.push('Cash collected at another location is excluded, so this total is unavailable.');
  if (!mature) netCollectionsCents = null;

  let acquired = facts.receiptsConnected && mature && netCollectionsCents !== null ? 0 : null;
  if (acquired !== null) {
    for (const net of familyNets.values()) {
      if ((net ?? 0) > 0) acquired += 1;
    }
  }

  if (mediaKnown && facts.receiptsConnected && mature && netCollectionsCents !== null) {
    for (const bucket of [...buckets.values(), unallocated]) {
      bucket.acquiredFamilies = 0;
      bucket.netCollectionsCents = 0;
    }
    for (const [familyId, lead] of winners) {
      const bucket = bucketFor(lead.metaCampaignId, lead.metaCampaignId ?? 'Unallocated');
      const net = familyNets.get(familyId) ?? 0;
      if (net > 0) bucket.acquiredFamilies = (bucket.acquiredFamilies ?? 0) + 1;
      bucket.netCollectionsCents = (bucket.netCollectionsCents ?? 0) + net;
    }
  } else {
    for (const bucket of buckets.values()) {
      bucket.acquiredFamilies = null;
      bucket.netCollectionsCents = null;
    }
    unallocated.acquiredFamilies = null;
    unallocated.netCollectionsCents = null;
  }

  let pinnedTotal: number | null = 0;
  for (const amount of pinned.values()) {
    if (amount === null || pinnedTotal === null) pinnedTotal = null;
    else pinnedTotal += amount;
  }
  const feeCents = floating === null || pinnedTotal === null ? null : floating + pinnedTotal;
  if (floating !== null && floating > 0 && mediaKnown && weightSum === 0) {
    notes.push('No media spend, so the fee stays unallocated.');
  }
  const acquisitionCostCents = mediaSpendCents === null || feeCents === null ? null : mediaSpendCents + feeCents;
  const directApplies = facts.directCostsConnected && mature && (source === 'meta' || source === 'all');
  const directCostCents = directApplies ? facts.directCosts[horizon] : null;
  if (facts.directCostsConnected && mature && (source === 'meta' || source === 'all') && directCostCents === null) {
    notes.push('Direct cost for this horizon was not supplied.');
  }
  if (facts.directCostsConnected && source !== 'meta' && source !== 'all') {
    notes.push('Direct cost is supplied for the paid cohort only.');
  }
  const grossProfitCents = netCollectionsCents === null || directCostCents === null
    ? null
    : netCollectionsCents - directCostCents;
  const contributionCents = grossProfitCents === null || acquisitionCostCents === null
    ? null
    : grossProfitCents - acquisitionCostCents;

  for (const bucket of [...buckets.values(), unallocated]) {
    const cost = bucket.mediaSpendCents === null || bucket.feeCents === null
      ? null
      : bucket.mediaSpendCents + bucket.feeCents;
    bucket.acquisitionCostCents = cost;
    bucket.mediaRoas = ratioFromSums(bucket.netCollectionsCents, bucket.mediaSpendCents);
    bucket.cacCents = ratioFromSums(cost, bucket.acquiredFamilies);
  }

  const withAd = [...winners.values()].filter((lead) => lead.metaAdId).length;
  const adLevelCoverage = acquired === null || acquired === 0 ? null : withAd / acquired;
  const adLevelLabeled = acquired === null ? 'unavailable' : `${withAd} of ${acquired}`;

  return {
    horizon,
    mature,
    currency: facts.currency,
    mediaSpendCents,
    feeCents,
    unallocatedFeeCents: unallocated.feeCents,
    acquisitionCostCents,
    leadCount,
    reactivations,
    acquiredFamilies: acquired,
    netCollectionsCents,
    directCostCents,
    grossProfitCents,
    mediaCplCents: ratioFromSums(mediaSpendCents, leadCount),
    cacCents: ratioFromSums(acquisitionCostCents, acquired),
    mediaRoas: ratioFromSums(netCollectionsCents, mediaSpendCents),
    allInReturn: ratioFromSums(netCollectionsCents, acquisitionCostCents),
    ltgpPerFamilyCents: ratioFromSums(grossProfitCents, acquired),
    ltgpToCac: ratioFromSums(grossProfitCents, acquisitionCostCents),
    contributionCents,
    roi: ratioFromSums(contributionCents, acquisitionCostCents),
    payback: { status: 'unavailable' },
    costPerAttendedCents: ratioFromSums(mediaSpendCents, attended),
    funnel: {
      leads: leadCount,
      evaluationsBooked: booked,
      evaluationsAttended: attended,
      payers: acquired,
      leadToPaid: ratioFromSums(acquired, leadCount),
    },
    adLevelCoverage,
    adLevelLabeled,
    campaigns: [...buckets.values()],
    unallocated,
    notes,
  };
}

export function observedPayback(facts: CohortFacts, source: EconomicsSource): Payback {
  if (!facts.leadsConnected || !facts.receiptsConnected || !facts.directCostsConnected || !facts.expensesConnected || !facts.expensesReviewed) {
    return { status: 'unavailable' };
  }
  const checkpoints: Array<{ ageDays: number; evaluation: CohortEvaluation }> = [
    { ageDays: 30, evaluation: evaluateCohort(facts, source, 'd30') },
    { ageDays: 90, evaluation: evaluateCohort(facts, source, 'd90') },
  ];
  const realized = evaluateCohort(facts, source, 'realized');
  const ages = realized.leadCount
    ? facts.leads
      .filter((lead) => facts.locationId === null || lead.locationId === facts.locationId)
      .map((lead) => (lead.createdOn && facts.asOf ? daysAfter(lead.createdOn, facts.asOf) : null))
      .filter((age): age is number => age !== null)
    : [];
  const realizedAge = ages.length > 0 ? Math.min(...ages) : null;
  const ordered = realizedAge === null ? checkpoints : [...checkpoints, { ageDays: realizedAge, evaluation: realized }];
  let sawImmature = false;
  for (const point of ordered) {
    if (!point.evaluation.mature) {
      sawImmature = true;
      continue;
    }
    if (point.evaluation.grossProfitCents === null || point.evaluation.acquisitionCostCents === null) {
      return { status: 'unavailable' };
    }
    if (point.evaluation.grossProfitCents >= point.evaluation.acquisitionCostCents) {
      return { status: 'recovered', ageDays: point.ageDays };
    }
  }
  if (sawImmature || realizedAge === null) return { status: 'insufficient_history' };
  return { status: 'not_yet' };
}

export function evaluateWithPayback(facts: CohortFacts, source: EconomicsSource, horizon: Horizon): CohortEvaluation {
  const evaluation = evaluateCohort(facts, source, horizon);
  const payback = observedPayback(facts, source);
  return { ...evaluation, payback };
}

export function presentEconomics(facts: CohortFacts, source: EconomicsSource, horizon: Horizon): {
  mode: CohortFacts['mode'];
  locationLabel: string;
  cohortLabel: string;
  asOf: string | null;
  currency: string | null;
  source: EconomicsSource;
  horizon: Horizon;
  selected: CohortEvaluation;
  horizons: Record<Horizon, CohortEvaluation>;
} {
  const horizons = {
    d30: evaluateWithPayback(facts, source, 'd30'),
    d90: evaluateWithPayback(facts, source, 'd90'),
    realized: evaluateWithPayback(facts, source, 'realized'),
  };
  return {
    mode: facts.mode,
    locationLabel: facts.locationLabel,
    cohortLabel: facts.cohortLabel,
    asOf: facts.asOf,
    currency: facts.currency,
    source,
    horizon,
    selected: horizons[horizon],
    horizons,
  };
}

export function formatMultiple(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  return `${value.toFixed(2)}×`;
}

export function formatRoi(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  const rounded = Math.round(value * 1000) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text}%`;
}

export function formatPayback(payback: Payback): string {
  if (payback.status === 'recovered') return `Day ${payback.ageDays}`;
  if (payback.status === 'not_yet') return 'Not yet recovered';
  if (payback.status === 'insufficient_history') return 'Insufficient history';
  return 'unavailable';
}

export { HORIZONS };
