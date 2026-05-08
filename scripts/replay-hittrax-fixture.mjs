#!/usr/bin/env node
/**
 * scripts/replay-hittrax-fixture.mjs
 *
 * Local-dev tool that mimics what hittrax-poll does on a real GetAvailable-
 * ThirdPartyData response, against the canned fixture in
 * supabase/functions/_shared/fixtures/hittrax-sample.json. Skips the actual
 * HitTrax HTTP call so we can prove the swings -> sessions -> personal_bests
 * -> points_ledger -> push fan-out chain end-to-end before HitTrax keys arrive.
 *
 * Usage:
 *   node scripts/replay-hittrax-fixture.mjs <kid_id>
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (same names the
 * Edge Functions use). Reads the fixture, parses it through the same field-
 * mapping logic, and UPSERTs sessions/swings against the supplied kid.
 *
 * The PR trigger fires on swing INSERT and writes personal_bests +
 * points_ledger automatically — we don't need to replicate that here. The
 * script prints a summary line so the operator can grep for "PR fanout".
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(2);
}

const kidId = process.argv[2];
if (!kidId) {
  console.error('Usage: node scripts/replay-hittrax-fixture.mjs <kid_id>');
  process.exit(2);
}

const FIELD_MAP = {
  event_id: ['SwingID', 'EventID', 'Id', 'id'],
  session_id: ['SessionID', 'session_id'],
  facility_id: ['FacilityID', 'facility_id'],
  occurred_at: ['TimeStamp', 'Timestamp', 'EventTime', 'occurred_at', 'Time'],
  exit_velocity_mph: ['Velo', 'ExitVelocity', 'ExitVelo', 'exit_velocity_mph', 'EV'],
  launch_angle_deg: ['LaunchAngle', 'VertAngle', 'launch_angle_deg', 'LA'],
  distance_ft: ['Distance', 'distance_ft', 'Dist'],
  contact_quality: ['ContactQuality', 'Quality', 'contact_quality'],
  result: ['Result', 'AB', 'result', 'Outcome'],
  pitch_speed_mph: ['PitchSpeed', 'PitchVelo', 'pitch_speed_mph'],
  spray_angle_deg: ['SprayAngle', 'HorzAngle', 'spray_angle_deg'],
};

const pickStr = (o, ks) => {
  for (const k of ks) {
    const v = o[k];
    if (typeof v === 'string' && v.length) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
};
const pickNum = (o, ks) => {
  for (const k of ks) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.length) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: kid, error: kidErr } = await supa
    .from('kids')
    .select('id, tenant_id, family_id, first_name')
    .eq('id', kidId)
    .maybeSingle();
  if (kidErr || !kid) {
    console.error('kid not found:', kidErr ?? '(no row)');
    process.exit(1);
  }

  const fixturePath = join(
    __dirname,
    '..',
    'supabase',
    'functions',
    '_shared',
    'fixtures',
    'hittrax-sample.json',
  );
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const rows = Array.isArray(fixture) ? fixture : (fixture.Data ?? fixture.Swings ?? []);
  console.log(`replay: kid=${kid.first_name ?? kid.id} swings_in_fixture=${rows.length}`);

  // Group by session id, UPSERT sessions, then UPSERT swings.
  const groups = new Map();
  const parsed = [];
  for (const raw of rows) {
    const eventId = pickStr(raw, FIELD_MAP.event_id);
    if (!eventId) continue;
    const sid = pickStr(raw, FIELD_MAP.session_id);
    const occurredRaw = pickStr(raw, FIELD_MAP.occurred_at) ?? new Date().toISOString();
    const occurred_at = Number.isNaN(Date.parse(occurredRaw))
      ? new Date().toISOString()
      : new Date(occurredRaw).toISOString();
    const swing = {
      capture_event_id: eventId,
      capture_session_id: sid,
      occurred_at,
      exit_velocity_mph: pickNum(raw, FIELD_MAP.exit_velocity_mph),
      launch_angle_deg: pickNum(raw, FIELD_MAP.launch_angle_deg),
      distance_ft: pickNum(raw, FIELD_MAP.distance_ft),
      contact_quality: pickStr(raw, FIELD_MAP.contact_quality),
      result: pickStr(raw, FIELD_MAP.result),
      pitch_speed_mph: pickNum(raw, FIELD_MAP.pitch_speed_mph),
      spray_angle_deg: pickNum(raw, FIELD_MAP.spray_angle_deg),
      facility_id: pickStr(raw, FIELD_MAP.facility_id),
      raw,
    };
    parsed.push(swing);
    if (sid) {
      if (!groups.has(sid)) groups.set(sid, []);
      groups.get(sid).push(swing);
    }
  }

  const sessionIdMap = new Map();
  for (const [sid, members] of groups.entries()) {
    const startedAt = members.reduce(
      (m, s) => (s.occurred_at < m ? s.occurred_at : m),
      members[0].occurred_at,
    );
    const endedAt = members.reduce(
      (m, s) => (s.occurred_at > m ? s.occurred_at : m),
      members[0].occurred_at,
    );
    const evs = members.map((m) => m.exit_velocity_mph).filter((v) => v != null);
    const dists = members.map((m) => m.distance_ft).filter((v) => v != null);
    const { data: up, error } = await supa
      .from('sessions')
      .upsert(
        {
          tenant_id: kid.tenant_id,
          kid_id: kid.id,
          capture_source: 'hittrax',
          capture_session_id: sid,
          facility_id: members.find((m) => m.facility_id)?.facility_id ?? null,
          started_at: startedAt,
          ended_at: endedAt,
          swing_count: members.length,
          best_exit_velocity_mph: evs.length ? Math.max(...evs) : null,
          avg_exit_velocity_mph: evs.length
            ? Math.round((evs.reduce((a, b) => a + b, 0) / evs.length) * 10) / 10
            : null,
          max_distance_ft: dists.length ? Math.max(...dists.map((d) => Math.round(d))) : null,
        },
        { onConflict: 'capture_source,capture_session_id' },
      )
      .select('id')
      .single();
    if (error) {
      console.error('session upsert failed:', error);
      continue;
    }
    sessionIdMap.set(sid, up.id);
    console.log(`session: ${sid} -> ${up.id} swings=${members.length}`);
  }

  let inserted = 0;
  for (const s of parsed) {
    const sessId = s.capture_session_id ? sessionIdMap.get(s.capture_session_id) ?? null : null;
    const { error } = await supa.from('swings').upsert(
      {
        tenant_id: kid.tenant_id,
        kid_id: kid.id,
        session_id: sessId,
        capture_source: 'hittrax',
        capture_event_id: s.capture_event_id,
        occurred_at: s.occurred_at,
        exit_velocity_mph: s.exit_velocity_mph,
        launch_angle_deg: s.launch_angle_deg,
        distance_ft: s.distance_ft != null ? Math.round(s.distance_ft) : null,
        contact_quality: s.contact_quality,
        result: s.result,
        pitch_speed_mph: s.pitch_speed_mph,
        spray_angle_deg: s.spray_angle_deg,
        raw: s.raw,
      },
      { onConflict: 'capture_source,capture_event_id' },
    );
    if (error) {
      console.error(`swing upsert failed event=${s.capture_event_id}:`, error);
      continue;
    }
    inserted++;
  }

  const { data: pbs } = await supa
    .from('personal_bests')
    .select('metric, value, achieved_at')
    .eq('kid_id', kid.id);
  const { data: kidNow } = await supa
    .from('kids')
    .select('points_balance')
    .eq('id', kid.id)
    .maybeSingle();

  console.log(`replay: swings_upserted=${inserted}`);
  console.log(`replay: personal_bests=${JSON.stringify(pbs ?? [])}`);
  console.log(`replay: kid.points_balance=${kidNow?.points_balance}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
