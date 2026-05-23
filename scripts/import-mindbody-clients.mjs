#!/usr/bin/env node
// =============================================================================
// scripts/import-mindbody-clients.mjs
// =============================================================================
// Imports MindBody "Clients" CSV export into Ballpark families + kids tables.
//
// CSV columns (standard MindBody export + optional parent columns):
//   ClientID, FirstName, LastName, Email, MobilePhone, BirthDate,
//   ParentFirstName (opt), ParentLastName (opt)
//
// Key design:
//   - Groups CSV rows by Email → one family per unique parent email
//   - Emails shared by multiple rows → one family, multiple kids
//   - Auth user UUID = UUID v5(MB_NS, "user:{email}") — deterministic
//   - Kid UUID      = UUID v5(MB_NS, "kid:{clientId}")  — deterministic
//   - Idempotent: auth users created with --legacy-peer-deps, families via
//     ON CONFLICT; kids via ON CONFLICT (id) DO NOTHING
//
// Usage:
//   node scripts/import-mindbody-clients.mjs \
//     --input scripts/fixtures/mindbody-clients-sample.csv \
//     [--dry-run] \
//     [--tenant-slug infinitehitting]
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { createHash, randomBytes } from 'crypto';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// UUID v5 namespace for all MindBody import records (arbitrary but fixed).
// Encodes "mindbo" in the last segment for easy identification.
const MB_NS = '00000000-0000-5000-8000-6d696e64626f';

// =============================================================================
// Args
// =============================================================================

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes('--dry-run');
const inputIdx = args.indexOf('--input');
const INPUT    = inputIdx !== -1 ? args[inputIdx + 1] : null;
const slugIdx  = args.indexOf('--tenant-slug');
const TENANT_SLUG = slugIdx !== -1 ? args[slugIdx + 1] : (process.env.EXPO_PUBLIC_TENANT_SLUG ?? 'infinitehitting');

if (!INPUT) {
  console.error('ERROR: --input <path/to/clients.csv> is required.');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

// =============================================================================
// UUID v5
// =============================================================================

/** Compute a UUID v5 string from a fixed namespace UUID string and a name. */
function uuidV5(namespace, name) {
  const nsHex   = namespace.replace(/-/g, '');
  const nsBytes = Buffer.from(nsHex, 'hex');
  const nameBytes = Buffer.from(name, 'utf8');
  const hash = createHash('sha1').update(nsBytes).update(nameBytes).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = hash.toString('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

function mbKidId(clientId)      { return uuidV5(MB_NS, `kid:${clientId}`); }
function mbAuthUserId(email)    { return uuidV5(MB_NS, `user:${email.toLowerCase().trim()}`); }

// =============================================================================
// CSV parser (no external deps)
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
// REST / Admin helpers
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

async function restUpsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...baseHeaders,
      Prefer: `return=minimal,resolution=ignore-duplicates`,
    },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`UPSERT ${table} → ${res.status}: ${t}`);
  }
}

async function adminRequest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: baseHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok && res.status !== 404) {
    throw new Error(`${method} /admin/${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

/** Find or create an auth user. Returns the user object.
 *
 * Imported accounts are created with:
 *   - email_confirm=false  — the account cannot be used for login until the
 *     parent completes an invite / password-reset flow.
 *   - A cryptographically random password (never logged, not derivable from
 *     any public input) — effectively unusable until the parent resets it
 *     via the proper onboarding email. This prevents account takeover via
 *     predictable credential generation.
 */
async function ensureAuthUser(id, email, meta) {
  // Check by deterministic ID first (fastest path on re-run).
  const existing = await adminRequest('GET', `users/${id}`);
  if (existing && existing.id) return { user: existing, created: false };

  const user = await adminRequest('POST', 'users', {
    id,
    email,
    password: randomBytes(32).toString('hex'), // cryptographically random — never predictable
    email_confirm: false,                       // account is inert until parent resets password
    user_metadata: meta,
  });
  return { user, created: true };
}

// =============================================================================
// Main
// =============================================================================

console.log(`\n${'='.repeat(65)}`);
console.log('MindBody Clients Import' + (DRY_RUN ? '  [DRY-RUN — no DB writes]' : ''));
console.log('='.repeat(65));
console.log(`Input:       ${INPUT}`);
console.log(`Tenant slug: ${TENANT_SLUG}`);

const rows = await parseCSV(INPUT);
console.log(`\nRows read:   ${rows.length}`);

// ── Group rows by email (lower-cased) ─────────────────────────────────────────
const familyMap = new Map(); // email → { meta, kids[] }
const duplicateClientIds = new Set();

for (const row of rows) {
  const email = (row.Email ?? '').toLowerCase().trim();
  if (!email) { console.warn(`  WARN: skipping row ${row.ClientID} — no email`); continue; }

  if (!familyMap.has(email)) {
    familyMap.set(email, {
      email,
      phone:     row.MobilePhone  ?? '',
      pFirst:    row.ParentFirstName?.trim() || null,
      pLast:     row.ParentLastName?.trim()  || null,
      fallbackLast: (row.LastName ?? '').trim(),
      kids: [],
    });
  } else {
    duplicateClientIds.add(email);
  }

  familyMap.get(email).kids.push({
    clientId:  row.ClientID,
    firstName: row.FirstName,
    lastName:  row.LastName,
    dob:       row.BirthDate || null,
    kidId:     mbKidId(row.ClientID),
  });
}

const familyCount = familyMap.size;
const kidCount    = rows.length;
const dupeCount   = [...familyMap.values()].filter(f => f.kids.length > 1).length;

// ── Reconciliation report ──────────────────────────────────────────────────────
console.log('\n─── Reconciliation Report ───────────────────────────────────────────');
console.log(`  Total rows read:           ${rows.length}`);
console.log(`  Unique parent emails:      ${familyCount}  → families to create`);
console.log(`  Total kids:                ${kidCount}  → kids to create`);
console.log(`  Emails with multiple kids: ${dupeCount}  (duplicate parent detection)`);
if (dupeCount > 0) {
  for (const [email, fam] of familyMap.entries()) {
    if (fam.kids.length > 1) {
      console.log(`    ${email}: ${fam.kids.map(k => `${k.firstName} ${k.lastName} (${k.clientId})`).join(', ')}`);
    }
  }
}

if (DRY_RUN) {
  console.log('\n[DRY-RUN] No database writes performed.');
  console.log('='.repeat(65) + '\n');
  process.exit(0);
}

// ── Resolve tenant ─────────────────────────────────────────────────────────────
console.log('\n─── Tenant Resolution ───────────────────────────────────────────────');
const tenants = await restGet(`tenants?slug=eq.${TENANT_SLUG}&select=id,name`);
if (!tenants.length) {
  console.error(`ERROR: tenant slug '${TENANT_SLUG}' not found.`);
  process.exit(1);
}
const TENANT_ID = tenants[0].id;
console.log(`  Tenant: ${tenants[0].name} (${TENANT_ID})`);

// ── Create auth users + families + kids ───────────────────────────────────────
console.log('\n─── Importing Families + Kids ───────────────────────────────────────');

let familiesCreated = 0, familiesSkipped = 0, kidsCreated = 0, kidsSkipped = 0;
const errors = [];

for (const [email, fam] of familyMap.entries()) {
  const authId  = mbAuthUserId(email);
  const pFirst  = fam.pFirst  ?? 'Parent';
  const pLast   = fam.pLast   ?? fam.fallbackLast ?? 'Unknown';

  try {
    const { created } = await ensureAuthUser(authId, email, {
      tenant_slug: TENANT_SLUG,
      first_name:  pFirst,
      last_name:   pLast,
      phone:       fam.phone,
    });

    if (created) {
      familiesCreated++;
      // handle_new_user trigger already created the families row.
    } else {
      familiesSkipped++;
    }

    // Insert kids (ON CONFLICT DO NOTHING for idempotency).
    for (const kid of fam.kids) {
      const kidRow = {
        id:         kid.kidId,
        family_id:  null, // filled below
        first_name: kid.firstName,
        last_name:  kid.lastName,
        date_of_birth: kid.dob || null,
        points_balance: 0,
      };

      // Look up family_id from families table.
      const famRows = await restGet(`families?parent_user_id=eq.${authId}&tenant_id=eq.${TENANT_ID}&select=id`);
      if (!famRows.length) {
        errors.push(`Family not found for ${email} (auth id: ${authId}). handle_new_user trigger may have failed.`);
        continue;
      }
      kidRow.family_id = famRows[0].id;

      try {
        await restUpsert('kids', kidRow);
        kidsCreated++;
      } catch (err) {
        if (err.message.includes('409') || err.message.includes('duplicate')) {
          kidsSkipped++;
        } else {
          errors.push(`kid ${kid.clientId} (${kid.firstName}): ${err.message}`);
        }
      }
    }

    process.stdout.write(`  ${created ? '[new]' : '[skip]'} ${email} → ${fam.kids.length} kid(s)\n`);
  } catch (err) {
    errors.push(`family ${email}: ${err.message}`);
    console.error(`  ERROR: ${email}: ${err.message}`);
  }
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`
${'='.repeat(65)}
DONE — MindBody Clients Import
${'='.repeat(65)}
  Families created:  ${familiesCreated}
  Families skipped:  ${familiesSkipped}  (already existed — idempotent)
  Kids created:      ${kidsCreated}
  Kids skipped:      ${kidsSkipped}  (already existed — idempotent)
  Errors:            ${errors.length}
${'='.repeat(65)}
`);

if (errors.length > 0) {
  console.error('Errors encountered:');
  errors.forEach(e => console.error(`  • ${e}`));
  process.exit(1);
}
