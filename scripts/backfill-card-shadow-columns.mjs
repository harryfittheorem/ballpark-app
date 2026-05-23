#!/usr/bin/env node
/**
 * scripts/backfill-card-shadow-columns.mjs
 *
 * Post-migration backfill: populate card shadow display columns on `families`
 * for members who already have a Stripe connected-account customer but whose
 * card_last4 column is NULL (i.e., they signed up before Task #233).
 *
 * Columns written:
 *   card_last4       (text)
 *   card_brand       (text)
 *   card_exp_month   (integer)
 *   card_exp_year    (integer)
 *
 * The script:
 *   1. Loads all families where stripe_connected_customer_id IS NOT NULL
 *      but card_last4 IS NULL (not yet backfilled).
 *   2. For each family, fetches the customer from Stripe (on the location's
 *      connected account) and retrieves their default payment method.
 *   3. If a default card is found, writes the four shadow columns.
 *   4. Prints a summary of successes, skips, and errors.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... \
 *   SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/backfill-card-shadow-columns.mjs [--dry-run]
 *
 * Flags:
 *   --dry-run   Print what would be written without making any DB changes.
 *
 * Safety:
 *   Idempotent — only touches rows where card_last4 IS NULL.
 *   Safe to re-run after partial failures.
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing required env vars: STRIPE_SECRET_KEY, SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function stripeGet(path, stripeAccountId) {
  const headers = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-06-20',
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe error ${res.status} on ${path}`);
  }
  return data;
}

async function main() {
  console.log(`[backfill-card-shadow-columns] Starting${DRY_RUN ? ' (DRY RUN)' : ''}…`);

  const { data: families, error } = await supabase
    .from('families')
    .select('id, stripe_connected_customer_id, primary_location_id')
    .not('stripe_connected_customer_id', 'is', null)
    .is('card_last4', null);

  if (error) {
    console.error('Failed to load families:', error.message);
    process.exit(1);
  }

  if (!families.length) {
    console.log('[backfill-card-shadow-columns] No families need backfill — done.');
    return;
  }

  console.log(`[backfill-card-shadow-columns] ${families.length} families to process.`);

  const locationIds = [...new Set(families.map(f => f.primary_location_id).filter(Boolean))];
  const { data: locations } = await supabase
    .from('locations')
    .select('id, stripe_account_id')
    .in('id', locationIds);

  const locationMap = Object.fromEntries((locations ?? []).map(l => [l.id, l.stripe_account_id]));

  let succeeded = 0;
  let skipped   = 0;
  let errors    = 0;

  for (const family of families) {
    const connectedAccountId = locationMap[family.primary_location_id];
    const customerId = family.stripe_connected_customer_id;

    if (!connectedAccountId) {
      console.warn(`  SKIP family=${family.id} — no connected Stripe account for location`);
      skipped++;
      continue;
    }

    try {
      const pmList = await stripeGet(
        `payment_methods?customer=${encodeURIComponent(customerId)}&type=card&limit=10`,
        connectedAccountId,
      );

      const pmData = pmList.data ?? [];
      if (!pmData.length) {
        console.warn(`  SKIP family=${family.id} customer=${customerId} — no cards on file`);
        skipped++;
        continue;
      }

      const sorted = [...pmData].sort((a, b) => b.created - a.created);
      const pm = sorted[0];
      const card = pm.card;
      const normalizedBrand = card.brand.charAt(0).toUpperCase() + card.brand.slice(1);

      console.log(`  ${DRY_RUN ? 'WOULD UPDATE' : 'UPDATE'} family=${family.id} → ${normalizedBrand} ····${card.last4} ${card.exp_month}/${card.exp_year}`);

      if (!DRY_RUN) {
        const { error: updateErr } = await supabase
          .from('families')
          .update({
            card_last4: card.last4,
            card_brand: normalizedBrand,
            card_exp_month: card.exp_month,
            card_exp_year: card.exp_year,
            updated_at: new Date().toISOString(),
          })
          .eq('id', family.id);

        if (updateErr) {
          console.error(`  ERROR family=${family.id}: ${updateErr.message}`);
          errors++;
          continue;
        }
      }
      succeeded++;
    } catch (err) {
      console.error(`  ERROR family=${family.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\n[backfill-card-shadow-columns] Complete.`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errors}`);

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
