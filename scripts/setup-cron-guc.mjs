#!/usr/bin/env node
// =============================================================================
// scripts/setup-cron-guc.mjs
// =============================================================================
// One-time setup: writes app.settings.supabase_url and
// app.settings.service_role_key as Postgres GUCs so that pg_cron jobs
// (cancellation + pause/resume) can call edge functions via pg_net.
//
// Usage:
//   node scripts/setup-cron-guc.mjs [--dry-run]
//
// Required env vars:
//   EXPO_PUBLIC_SUPABASE_URL   — e.g. https://exjcwvvglthnxerzpukw.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — from Supabase dashboard → Settings → API
//   SUPABASE_ACCESS_TOKEN      — personal access token for the Management API
//
// What it does:
//   1. Calls the Supabase Management API /database/query endpoint to:
//        ALTER DATABASE postgres SET app.settings.supabase_url  = '<url>';
//        ALTER DATABASE postgres SET app.settings.service_role_key = '<key>';
//        SELECT pg_reload_conf();
//   2. Verifies the GUCs are readable.
//   3. Verifies both cron jobs appear in cron.job.
//
// Idempotent: safe to re-run. ALTER DATABASE SET is idempotent.
// =============================================================================

import { execSync } from 'node:child_process';

const DRY_RUN = process.argv.includes('--dry-run');

const SUPABASE_URL     = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN;

// Derive project ref from URL: https://<ref>.supabase.co
const PROJECT_REF = SUPABASE_URL
  ? new URL(SUPABASE_URL).hostname.split('.')[0]
  : null;

function requireEnv(name, value) {
  if (!value) {
    console.error(`ERROR: ${name} is not set.`);
    process.exit(1);
  }
}

requireEnv('EXPO_PUBLIC_SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE_KEY);
requireEnv('SUPABASE_ACCESS_TOKEN', ACCESS_TOKEN);

const MGMT_BASE = 'https://api.supabase.com';

async function dbQuery(sql) {
  const res = await fetch(`${MGMT_BASE}/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    const parsed = (() => { try { return JSON.parse(text); } catch { return null; } })();
    // ALTER DATABASE requires superuser — the Management API runs as a restricted user.
    // If we hit a permission error, emit clear guidance and exit.
    if (res.status === 400 && text.includes('permission denied to set parameter')) {
      console.error('\n✗ The Management API cannot set database GUCs (requires superuser).');
      console.error('\nRun the following SQL manually in the Supabase SQL editor:');
      console.error('  https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new\n');
      console.error(`  ALTER DATABASE postgres SET "app.settings.supabase_url"     = '${SUPABASE_URL}';`);
      console.error(`  ALTER DATABASE postgres SET "app.settings.service_role_key" = '<your-service-role-key>';`);
      console.error(`  SELECT pg_reload_conf();\n`);
      process.exit(1);
    }
    throw new Error(`Management API error ${res.status}: ${parsed?.message ?? text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function main() {
  console.log(`Project ref: ${PROJECT_REF}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(DRY_RUN ? '[DRY RUN — no changes will be made]' : '');

  // ── Step 1: Set GUCs ──────────────────────────────────────────────────────
  const setGucSql = `
    ALTER DATABASE postgres SET "app.settings.supabase_url"      = '${SUPABASE_URL}';
    ALTER DATABASE postgres SET "app.settings.service_role_key"  = '${SERVICE_ROLE_KEY}';
    SELECT pg_reload_conf();
  `;

  // Redacted version for display — never print the actual key
  const setGucSqlRedacted = `
    ALTER DATABASE postgres SET "app.settings.supabase_url"      = '${SUPABASE_URL}';
    ALTER DATABASE postgres SET "app.settings.service_role_key"  = '<SUPABASE_SERVICE_ROLE_KEY>';
    SELECT pg_reload_conf();
  `;

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Would execute:');
    console.log(setGucSqlRedacted);
  } else {
    console.log('\nStep 1: Setting GUCs...');
    await dbQuery(setGucSql);
    console.log('  ✓ GUCs set and pg_reload_conf() called');
  }

  // ── Step 2: Verify GUCs are readable ─────────────────────────────────────
  if (!DRY_RUN) {
    console.log('\nStep 2: Verifying GUCs...');
    const rows = await dbQuery(`
      SELECT
        current_setting('app.settings.supabase_url', true)     AS url_set,
        current_setting('app.settings.service_role_key', true) AS key_set;
    `);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row?.url_set && row?.key_set) {
      console.log(`  ✓ app.settings.supabase_url is set`);
      console.log(`  ✓ app.settings.service_role_key is set`);
    } else {
      console.error('  ✗ GUCs do not appear to be readable after setting. Check DB access.');
      process.exit(1);
    }
  }

  // ── Step 3: Verify cron jobs are registered ───────────────────────────────
  if (!DRY_RUN) {
    console.log('\nStep 3: Checking cron job registrations...');
    const cronRows = await dbQuery(`
      SELECT jobname, schedule, active
        FROM cron.job
       WHERE jobname IN (
         'process-membership-cancellations-daily',
         'resume-paused-memberships-daily'
       )
       ORDER BY jobname;
    `);

    const jobs = Array.isArray(cronRows) ? cronRows : [];
    const expected = [
      'process-membership-cancellations-daily',
      'resume-paused-memberships-daily',
    ];

    for (const name of expected) {
      const found = jobs.find(j => j.jobname === name);
      if (found) {
        console.log(`  ✓ ${name} — schedule: ${found.schedule}, active: ${found.active}`);
      } else {
        console.warn(`  ✗ ${name} not found in cron.job`);
        console.warn('    Run: npx supabase db push to apply the latest migrations, then re-run this script.');
      }
    }
  }

  console.log('\nDone.');
  if (DRY_RUN) {
    console.log('Re-run without --dry-run to apply changes.');
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
