#!/usr/bin/env node
// =============================================================================
// scripts/import-mindbody-sales.mjs
// =============================================================================
// Imports MindBody "Sales" CSV export into Ballpark payment_events table as
// historical revenue records.
//
// CSV columns (standard MindBody export):
//   ClientID, SaleDate, Description, Quantity, Price, PaymentMethod
//
// Mapping rules:
//   - Price (dollars) × 100 → amount_cents
//   - PaymentMethod: EFT/ACH → 'eft' | Credit Card/Visa/MC/Amex → 'card' | else → 'cash'
//   - payment_events.status = 'paid' (all imported sales are historical successes)
//   - Payment event UUID = UUID v5(MB_NS, "payment:{clientId}:{saleDate}:{description}:{price}")
//
// Usage:
//   node scripts/import-mindbody-sales.mjs \
//     --input scripts/fixtures/mindbody-sales-sample.csv \
//     [--dry-run] \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createHash }      from 'crypto';
import { createReadStream } from 'fs';
import { createInterface }  from 'readline';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MB_NS        = '00000000-0000-5000-8000-6d696e64626f';

// =============================================================================
// Args
// =============================================================================

const args        = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const inputIdx    = args.indexOf('--input');
const INPUT       = inputIdx !== -1 ? args[inputIdx + 1] : null;
const slugIdx     = args.indexOf('--tenant-slug');
const TENANT_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

if (!INPUT) { console.error('ERROR: --input <path> is required.'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// UUID v5
// =============================================================================

function uuidV5(namespace, name) {
  const nsHex   = namespace.replace(/-/g, '');
  const nsBytes = Buffer.from(nsHex, 'hex');
  const hash = createHash('sha1').update(nsBytes).update(Buffer.from(name, 'utf8')).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const h = hash.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function mbKidId(clientId) { return uuidV5(MB_NS, `kid:${clientId}`); }
function mbPaymentId(clientId, saleDate, description, price) {
  return uuidV5(MB_NS, `payment:${clientId}:${saleDate}:${description}:${price}`);
}

// =============================================================================
// CSV parser
// =============================================================================

async function parseCSV(filePath) {
  const rows  = [];
  const rl    = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let headers = null;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cols = splitCSVLine(trimmed);
    if (!headers) { headers = cols.map(h => h.trim()); continue; }
    const row = {};
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
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

async function restInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders, Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`INSERT ${table} → ${res.status}: ${t}`);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function parseMoney(str) {
  const n = parseFloat((str ?? '').replace(/[$,]/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function mapPaymentMethod(str) {
  const s = (str ?? '').toLowerCase();
  if (s.includes('eft') || s.includes('ach') || s.includes('bank')) return 'eft';
  if (s.includes('card') || s.includes('visa') || s.includes('mc') || s.includes('amex') || s.includes('credit')) return 'card';
  return 'cash';
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('MindBody Sales Import' + (DRY_RUN ? '  [DRY-RUN]' : ''));
console.log('='.repeat(65));
console.log(`Input: ${INPUT}`);

const rows = await parseCSV(INPUT);
console.log(`Rows read: ${rows.length}`);

// ── Analyse ────────────────────────────────────────────────────────────────────
const totalRevenueCents = rows.reduce((sum, r) => sum + parseMoney(r.Price) * parseInt(r.Quantity || '1', 10), 0);
const methodBreakdown   = {};
for (const row of rows) {
  const method = mapPaymentMethod(row.PaymentMethod);
  methodBreakdown[method] = (methodBreakdown[method] ?? 0) + 1;
}

console.log('\n─── Reconciliation Report ───────────────────────────────────────────');
console.log(`  Total rows:        ${rows.length}`);
console.log(`  Total revenue:     $${(totalRevenueCents / 100).toFixed(2)}`);
console.log(`  By payment method: ${JSON.stringify(methodBreakdown)}`);

if (DRY_RUN) {
  console.log('\n[DRY-RUN] No database writes performed.');
  console.log('='.repeat(65) + '\n');
  process.exit(0);
}

// ── Resolve tenant ─────────────────────────────────────────────────────────────
const tenants = await restGet(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
if (!tenants.length) { console.error(`ERROR: tenant slug '${TENANT_SLUG}' not found.`); process.exit(1); }
const TENANT_ID = tenants[0].id;
console.log(`\nTenant: ${tenants[0].name} (${TENANT_ID})`);

// ── Import payment events ──────────────────────────────────────────────────────
console.log('\n─── Importing Sales → Payment Events ────────────────────────────────');

let inserted = 0, skipped = 0, errCount = 0;
const noKidRows = [];

for (const row of rows) {
  const clientId = row.ClientID;
  const kidId    = mbKidId(clientId);
  const qty      = parseInt(row.Quantity || '1', 10);
  const unitCents = parseMoney(row.Price);
  const totalCents = unitCents * qty;
  const paymentId  = mbPaymentId(clientId, row.SaleDate, row.Description, row.Price);
  const method     = mapPaymentMethod(row.PaymentMethod);

  // Look up family via kid.
  const kidRows = await restGet(`kids?id=eq.${kidId}&select=id,family_id`);
  if (!kidRows.length) {
    noKidRows.push(clientId);
    skipped++;
    continue;
  }
  const familyId = kidRows[0].family_id;

  // Look up membership (best-effort, nullable).
  const memRows = await restGet(
    `memberships?family_id=eq.${familyId}&tenant_id=eq.${TENANT_ID}&select=id&limit=1`
  );
  const membershipId = memRows.length ? memRows[0].id : null;

  const createdAt = new Date(`${row.SaleDate}T10:00:00Z`);
  if (isNaN(createdAt.getTime())) {
    console.warn(`  WARN: invalid SaleDate "${row.SaleDate}" for ${clientId}, using now()`);
  }

  const paymentRow = {
    id:             paymentId,
    tenant_id:      TENANT_ID,
    family_id:      familyId,
    membership_id:  membershipId,
    amount_cents:   totalCents,
    status:         'paid',
    payment_method: method,
    created_at:     isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
  };

  try {
    await restInsert('payment_events', paymentRow);
    inserted++;
    console.log(`  [upsert] ${clientId} ${row.SaleDate} "${row.Description}" $${(totalCents / 100).toFixed(2)} (${method})`);
  } catch (err) {
    errCount++;
    console.error(`  ERROR: ${clientId}: ${err.message}`);
  }
}

if (noKidRows.length) {
  console.warn(`\n  WARN: ${noKidRows.length} sales skipped — kid not found:`);
  noKidRows.forEach(id => console.warn(`    ClientID ${id}`));
}

console.log(`
${'='.repeat(65)}
DONE — MindBody Sales Import
${'='.repeat(65)}
  Payment events inserted: ${inserted}
  Skipped (no kid found):  ${skipped}
  Errors:                  ${errCount}
${'='.repeat(65)}
`);

if (errCount > 0) process.exit(1);
