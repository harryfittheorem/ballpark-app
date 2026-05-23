#!/usr/bin/env node
// =============================================================================
// scripts/reconcile-stripe-migration.mjs
// =============================================================================
// Reads Stripe's PAN migration mapping JSON and updates families.stripe_customer_id
// for all migrated members.
//
// Input JSON format (array of objects):
//   [
//     {
//       "old_customer_id": "cus_OLD123",
//       "new_customer_id": "cus_NEW456",
//       "email": "parent@example.com"     ← optional but improves matching
//     },
//     ...
//   ]
//
// Matching strategy (in order):
//   1. Email match: find family by parent_email = row.email (most reliable)
//   2. Old customer ID match: find family by stripe_customer_id = old_customer_id
//   3. If neither matches → skip + report
//
// For each matched family:
//   - Sets families.stripe_customer_id = new_customer_id
//   - Optionally fetches card display info from Stripe API if STRIPE_SECRET_KEY is set
//
// Usage:
//   node scripts/reconcile-stripe-migration.mjs \
//     --input scripts/fixtures/stripe-migration-map.json \
//     [--dry-run] \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Optional env (for card info lookup):
//   STRIPE_SECRET_KEY
// =============================================================================

import { readFile }  from 'fs/promises';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_KEY   = process.env.STRIPE_SECRET_KEY ?? null;

// =============================================================================
// Args
// =============================================================================

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const inputIdx    = args.indexOf('--input');
const INPUT       = inputIdx !== -1 ? args[inputIdx + 1] : null;
const slugIdx     = args.indexOf('--tenant-slug');
const TENANT_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

if (!INPUT) { console.error('ERROR: --input <path/to/stripe-migration-map.json> is required.'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// REST helpers
// =============================================================================

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...baseHeaders, Prefer: 'return=representation' },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return []; }
}

async function restPatch(table, filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PATCH ${table} → ${res.status}: ${t}`);
  }
}

// =============================================================================
// Stripe helper (optional — fetches card display info)
// =============================================================================

/**
 * Fetch a Stripe customer with its default source expanded so card fields
 * are returned as an object (not just an ID string).
 * Falls back gracefully if Stripe key is absent or the customer not found.
 */
async function fetchStripeCustomer(customerId) {
  if (!STRIPE_KEY) return null;
  try {
    const url = `https://api.stripe.com/v1/customers/${customerId}?expand[]=default_source`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Extract card display fields from an expanded Stripe customer object.
 *
 * Stripe returns `default_source` as a string ID unless the resource is
 * expanded with `?expand[]=default_source`.  With expansion, it becomes
 * a Card object with brand / last4 / exp_month / exp_year fields.
 *
 * We also attempt to pull from `invoice_settings.default_payment_method`
 * (PaymentMethod object) which is common on newer Stripe integrations.
 */
function extractCardInfo(stripeCustomer) {
  if (!stripeCustomer) return {};

  // Path 1: expanded default_source (Card object on older integrations).
  const src = stripeCustomer.default_source;
  if (src && typeof src === 'object' && src.object === 'card') {
    return {
      card_brand:     src.brand     ?? null,
      card_last4:     src.last4     ?? null,
      card_exp_month: src.exp_month ?? null,
      card_exp_year:  src.exp_year  ?? null,
    };
  }

  // Path 2: default_payment_method (PaymentMethod object on newer integrations).
  const pm = stripeCustomer.invoice_settings?.default_payment_method;
  if (pm && typeof pm === 'object' && pm.card) {
    return {
      card_brand:     pm.card.brand     ?? null,
      card_last4:     pm.card.last4     ?? null,
      card_exp_month: pm.card.exp_month ?? null,
      card_exp_year:  pm.card.exp_year  ?? null,
    };
  }

  // No card info available (ACH, no default, or unexpanded ID).
  return {};
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('Stripe Migration Reconciliation' + (DRY_RUN ? '  [DRY-RUN]' : ''));
console.log('='.repeat(65));
console.log(`Input:       ${INPUT}`);
console.log(`Tenant slug: ${TENANT_SLUG}`);
console.log(`Stripe API:  ${STRIPE_KEY ? 'enabled (card info will be fetched)' : 'disabled (set STRIPE_SECRET_KEY to enable)'}`);

const mapping = JSON.parse(await readFile(INPUT, 'utf8'));
if (!Array.isArray(mapping)) {
  console.error('ERROR: Input JSON must be an array of objects.');
  process.exit(1);
}
console.log(`Entries:     ${mapping.length}`);

// ── Resolve tenant ─────────────────────────────────────────────────────────────
const tenants = await restGet(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
if (!tenants.length) { console.error(`ERROR: tenant slug '${TENANT_SLUG}' not found.`); process.exit(1); }
const TENANT_ID = tenants[0].id;
console.log(`Tenant:      ${tenants[0].name} (${TENANT_ID})\n`);

// ── Process each mapping entry ─────────────────────────────────────────────────
console.log('─── Processing Entries ──────────────────────────────────────────────');

let updated = 0, skipped = 0;
const errors   = [];
const warnings = [];
const notFound = [];

for (const entry of mapping) {
  const { old_customer_id, new_customer_id, email } = entry;

  if (!new_customer_id) {
    warnings.push(`Entry missing new_customer_id: ${JSON.stringify(entry)}`);
    skipped++;
    continue;
  }

  let family = null;

  // Strategy 1: match by email.
  if (email) {
    const byEmail = await restGet(
      `families?tenant_id=eq.${TENANT_ID}&parent_email=eq.${encodeURIComponent(email)}&select=id,parent_email,stripe_customer_id&limit=1`
    );
    if (byEmail.length) family = byEmail[0];
  }

  // Strategy 2: match by old stripe_customer_id.
  if (!family && old_customer_id) {
    const byOldId = await restGet(
      `families?tenant_id=eq.${TENANT_ID}&stripe_customer_id=eq.${old_customer_id}&select=id,parent_email,stripe_customer_id&limit=1`
    );
    if (byOldId.length) family = byOldId[0];
  }

  if (!family) {
    notFound.push(`old=${old_customer_id ?? 'n/a'}, email=${email ?? 'n/a'}`);
    skipped++;
    continue;
  }

  console.log(`  ${DRY_RUN ? '[dry-run] ' : ''}${family.parent_email ?? family.id}: ${old_customer_id ?? 'n/a'} → ${new_customer_id}`);

  if (DRY_RUN) { updated++; continue; }

  // Fetch card info from Stripe if key is available.
  const stripeCustomer = await fetchStripeCustomer(new_customer_id);
  const cardInfo       = extractCardInfo(stripeCustomer);

  try {
    await restPatch('families', `id=eq.${family.id}`, {
      stripe_customer_id: new_customer_id,
      ...cardInfo,
    });
    updated++;
  } catch (err) {
    errors.push(`family ${family.id}: ${err.message}`);
    console.error(`  ERROR: ${family.id}: ${err.message}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`
${'='.repeat(65)}
DONE — Stripe Migration Reconciliation${DRY_RUN ? ' (DRY-RUN)' : ''}
${'='.repeat(65)}
  Entries processed:   ${mapping.length}
  Families updated:    ${updated}
  Not found / skipped: ${skipped}
  Errors:              ${errors.length}
${'='.repeat(65)}
`);

if (notFound.length) {
  console.warn('Could not match the following entries to a family:');
  notFound.forEach(r => console.warn(`  • ${r}`));
}
if (errors.length) {
  console.error('Errors:');
  errors.forEach(e => console.error(`  • ${e}`));
  process.exit(1);
}
