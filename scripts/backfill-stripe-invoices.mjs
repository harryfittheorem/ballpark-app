#!/usr/bin/env node
/**
 * scripts/backfill-stripe-invoices.mjs
 *
 * Backfill historical Stripe invoices into the payment_events table for all
 * locations that have a connected Stripe account.  Run this:
 *   • After any bulk enrollment import that bypassed the stripe-webhook path.
 *   • When adding a new location with an existing Stripe history.
 *   • Any time payment_events appears sparse relative to actual Stripe charges.
 *
 * What it does:
 *   1. Loads all locations with a connected Stripe account.
 *   2. For each location, builds a map of stripe_subscription_id → membership
 *      (tenant_id, family_id, membership_id) from the local DB.
 *   3. Lists all Stripe invoices (paid + uncollectible) for the past 12 months
 *      from that connected account, paginating with starting_after.
 *   4. For each invoice, looks up the matching membership via the subscription ID.
 *   5. Checks whether a payment_events row with the same (stripe_invoice_id, status)
 *      already exists (idempotency guard) and skips if so.
 *   6. Inserts the missing row.
 *
 * Idempotency:
 *   Safe to re-run.  Already-inserted rows are detected via
 *   stripe_invoice_id + status and skipped.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_... \
 *   SUPABASE_URL=https://... \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/backfill-stripe-invoices.mjs [--dry-run] [--months=N]
 *
 * Flags:
 *   --dry-run     Print what would be inserted without touching the DB.
 *   --months=N    Look back N months (default 12).
 *
 * Required env:
 *   STRIPE_SECRET_KEY          (sk_live_... or sk_test_...)
 *   SUPABASE_URL               (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// ── CLI flags ───────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

const monthsArg = process.argv.find(a => a.startsWith('--months='));
const MONTHS_BACK = monthsArg ? parseInt(monthsArg.split('=')[1], 10) : 12;
if (isNaN(MONTHS_BACK) || MONTHS_BACK < 1) {
  console.error('--months must be a positive integer');
  process.exit(1);
}

// ── Env ─────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing required env vars: STRIPE_SECRET_KEY, SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  realtime: { transport: ws },
});

// ── Stripe helpers ───────────────────────────────────────────────────────────

const STRIPE_API_VERSION = '2024-06-20';

async function stripeGet(path, stripeAccountId) {
  const headers = {
    'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': STRIPE_API_VERSION,
  };
  if (stripeAccountId) headers['Stripe-Account'] = stripeAccountId;

  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe error ${res.status} on ${path}`);
  }
  return data;
}

/**
 * Fetch all pages of a Stripe list endpoint.
 * Stripe list responses: { data: [...], has_more: bool, data.at(-1).id → starting_after }
 */
async function stripeListAll(basePath, params, stripeAccountId) {
  const results = [];
  let startingAfter = null;

  for (;;) {
    const qs = new URLSearchParams(params);
    if (startingAfter) qs.set('starting_after', startingAfter);
    const page = await stripeGet(`${basePath}?${qs}`, stripeAccountId);
    results.push(...(page.data ?? []));
    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data.at(-1).id;
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `[backfill-stripe-invoices] Starting${DRY_RUN ? ' (DRY RUN)' : ''} — looking back ${MONTHS_BACK} month(s)`,
  );

  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  // ── 1. Load connected locations ──────────────────────────────────────────
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id, stripe_account_id, stripe_onboarding_status')
    .not('stripe_account_id', 'is', null)
    .eq('stripe_onboarding_status', 'connected');

  if (locErr) {
    console.error('[backfill-stripe-invoices] Failed to load locations:', locErr.message);
    process.exit(1);
  }

  if (!locations.length) {
    console.log('[backfill-stripe-invoices] No connected Stripe locations — nothing to do.');
    return;
  }

  console.log(`[backfill-stripe-invoices] ${locations.length} connected location(s) found.`);

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;

  for (const location of locations) {
    const accountId = location.stripe_account_id;
    console.log(`\n  Location ${location.id} — Stripe account ${accountId}`);

    // ── 2. Build subscription_id → membership map for this location ─────────
    const { data: memberships, error: memErr } = await supabase
      .from('memberships')
      .select(`
        id, tenant_id, family_id, stripe_subscription_id,
        families!inner(primary_location_id)
      `)
      .not('stripe_subscription_id', 'is', null)
      .eq('families.primary_location_id', location.id);

    if (memErr) {
      console.error(`  ERROR loading memberships for location ${location.id}: ${memErr.message}`);
      totalErrors++;
      continue;
    }

    if (!memberships.length) {
      console.log('  SKIP — no memberships with a Stripe subscription.');
      continue;
    }

    const subMap = new Map();
    for (const m of memberships) {
      subMap.set(m.stripe_subscription_id, {
        membership_id: m.id,
        tenant_id:     m.tenant_id,
        family_id:     m.family_id,
      });
    }
    console.log(`  ${subMap.size} subscription(s) mapped.`);

    // ── 3. Fetch Stripe invoices (paid + uncollectible/failed) ──────────────
    let invoices;
    try {
      // Stripe "uncollectible" = invoices that exhausted all retries (failed to collect).
      // "paid" = successfully charged.
      // We fetch both so the billing table shows the full payment history.
      const [paid, uncollectible] = await Promise.all([
        stripeListAll(
          'invoices',
          { limit: 100, status: 'paid', created: sinceUnix },
          accountId,
        ),
        stripeListAll(
          'invoices',
          { limit: 100, status: 'uncollectible', created: sinceUnix },
          accountId,
        ),
      ]);
      invoices = [...paid, ...uncollectible];
      console.log(`  Stripe returned ${paid.length} paid + ${uncollectible.length} uncollectible invoice(s).`);
    } catch (err) {
      console.error(`  ERROR fetching Stripe invoices: ${err.message}`);
      totalErrors++;
      continue;
    }

    if (!invoices.length) {
      console.log('  SKIP — no invoices in range.');
      continue;
    }

    // ── 4. Load existing payment_events stripe_invoice_ids for this account
    //       in one batch to avoid N+1 Supabase queries.
    const invoiceIds = invoices.map(inv => inv.id).filter(Boolean);

    const { data: existingRows } = await supabase
      .from('payment_events')
      .select('stripe_invoice_id, status')
      .in('stripe_invoice_id', invoiceIds);

    // Build a Set of "invoiceId|status" strings for fast idempotency checks.
    const existingKeys = new Set(
      (existingRows ?? []).map(r => `${r.stripe_invoice_id}|${r.status}`),
    );

    // ── 5. Upsert missing rows ───────────────────────────────────────────────
    for (const inv of invoices) {
      if (!inv.subscription) continue;

      const mem = subMap.get(inv.subscription);
      if (!mem) {
        // Invoice belongs to a subscription we don't recognise in our DB
        // (e.g. a direct product charge not tied to a membership).
        continue;
      }

      // Map Stripe invoice status → our payment_events status
      const status = inv.status === 'paid' ? 'paid' : 'failed';
      const amountCents = status === 'paid'
        ? (inv.amount_paid ?? 0)
        : (inv.amount_due ?? 0);
      const invoiceDate = inv.created
        ? new Date(inv.created * 1000).toISOString()
        : new Date().toISOString();

      const key = `${inv.id}|${status}`;
      if (existingKeys.has(key)) {
        totalSkipped++;
        continue;
      }

      console.log(
        `  ${DRY_RUN ? 'WOULD INSERT' : 'INSERT'} invoice=${inv.id} status=${status} amount=${amountCents} date=${invoiceDate.slice(0, 10)} membership=${mem.membership_id}`,
      );

      if (!DRY_RUN) {
        try {
          const row = {
            tenant_id:        mem.tenant_id,
            family_id:        mem.family_id,
            membership_id:    mem.membership_id,
            amount_cents:     amountCents,
            status,
            payment_method:   'eft',
            stripe_invoice_id: inv.id,
            created_at:       invoiceDate,
          };

          const { error: insertErr } = await supabase
            .from('payment_events')
            .insert(row);

          if (insertErr) {
            console.error(`  ERROR inserting invoice=${inv.id}: ${insertErr.message}`);
            totalErrors++;
          } else {
            totalInserted++;
            // Prevent Supabase from rate-limiting us on large data sets
            existingKeys.add(key);
          }
        } catch (err) {
          console.error(`  ERROR invoice=${inv.id}: ${err.message}`);
          totalErrors++;
        }
      } else {
        totalInserted++;
      }
    }
  }

  console.log('\n[backfill-stripe-invoices] Complete.');
  console.log(`  Inserted:  ${totalInserted}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  Skipped:   ${totalSkipped}`);
  console.log(`  Errors:    ${totalErrors}`);

  if (totalErrors > 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
