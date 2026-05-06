#!/usr/bin/env node
// =============================================================================
// Static guard: videos.mux_asset_id stays NOT NULL + UNIQUE across migrations.
// =============================================================================
// Why: the mux-webhook Edge Function runs as service role (bypasses RLS) and
// keys every UPDATE on the UNIQUE videos.mux_asset_id column. Lose either
// NOT NULL or UNIQUE and a forged Mux event becomes a cross-tenant write
// vector.
//
// This script scans every migration in supabase/migrations/ and fails if it
// finds a statement that relaxes those properties on videos.mux_asset_id
// without an explicit acknowledgement comment on the offending line:
//
//   ALTER TABLE public.videos ALTER COLUMN mux_asset_id DROP NOT NULL;
//     -- ALLOW-MUX-ASSET-ID-RELAX: <reason and equivalent replacement>
//
// The override is intentionally clunky so it shows up in code review.
//
// Wired into scripts/post-merge.sh; also runnable standalone:
//   node scripts/check-mux-asset-id-constraint.mjs
// =============================================================================

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = 'supabase/migrations';
const ALLOW_MARKER = 'ALLOW-MUX-ASSET-ID-RELAX';

// Each rule: a regex matched against a single non-comment-stripped line.
// `description` is shown when it fires.
const FORBIDDEN_PATTERNS = [
  {
    description: 'drops NOT NULL on videos.mux_asset_id',
    re: /ALTER\s+COLUMN\s+mux_asset_id\b[^;]*\bDROP\s+NOT\s+NULL/i,
  },
  {
    description: 'drops the auto-generated UNIQUE constraint videos_mux_asset_id_key',
    re: /DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?["']?videos_mux_asset_id_key\b/i,
  },
  {
    description: 'drops a unique index on mux_asset_id',
    re: /DROP\s+INDEX\b[^;]*\bmux_asset_id\b/i,
  },
  {
    description: 'drops the mux_asset_id column',
    re: /ALTER\s+TABLE[^;]*\bvideos\b[\s\S]*?DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?["']?mux_asset_id\b/i,
  },
  {
    description: 'drops the entire videos table',
    re: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?videos\b/i,
  },
];

function stripLineComment(line) {
  const idx = line.indexOf('--');
  return idx === -1 ? line : line.slice(0, idx);
}

function lineHasAllow(line) {
  return line.includes(ALLOW_MARKER);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const violations = [];

for (const file of files) {
  const path = join(MIGRATIONS_DIR, file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const code = stripLineComment(raw);
    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.re.test(code)) {
        if (lineHasAllow(raw)) continue;
        violations.push({
          file,
          line: i + 1,
          rule: rule.description,
          text: raw.trim(),
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('[check-mux-asset-id-constraint] FAIL: videos.mux_asset_id invariant relaxed');
  console.error('  videos.mux_asset_id MUST stay NOT NULL + UNIQUE — the mux-webhook');
  console.error('  Edge Function depends on it for tenant isolation.');
  console.error('');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.rule}`);
    console.error(`    > ${v.text}`);
  }
  console.error('');
  console.error(`  If you really need to restructure this column, append "-- ${ALLOW_MARKER}: <reason>"`);
  console.error('  to the offending line AND make sure the equivalent constraint is re-established');
  console.error('  in the same migration.');
  process.exit(1);
}

console.log(`[check-mux-asset-id-constraint] PASS (scanned ${files.length} migration(s))`);
