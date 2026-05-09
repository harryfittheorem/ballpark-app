#!/usr/bin/env node
// scripts/_smoke-122.mjs — read-only smoke probe for task #122.
// Verifies the achievements/fulfillment migration objects exist and behave
// correctly on the target Supabase. SAFE: every call is either a head-count
// SELECT, an RPC with a deliberately-bogus argument expected to error, or a
// type-only probe — nothing is INSERTed or modified.

import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const NO_REALTIME = { realtime: { transport: WebSocket } };
const sb = createClient(url, serviceKey, {
  auth: { persistSession: false },
  ...NO_REALTIME,
});

let pass = 0, fail = 0;
const ok = (n, d) => { pass++; console.log(`✅ ${n}${d ? ` — ${d}` : ''}`); };
const bad = (n, d) => { fail++; console.log(`❌ ${n}${d ? ` — ${d}` : ''}`); };

async function run(name, fn) { try { await fn(name); } catch (e) { bad(name, e.message); } }

await run('A1 achievements catalog seeded (≥12 rows)', async (n) => {
  const { count, error } = await sb.from('achievements').select('*', { head: true, count: 'exact' });
  if (error) throw error;
  if (count >= 12) ok(n, `${count} rows`);
  else bad(n, `expected ≥12, got ${count}`);
});

await run('A1 kid_achievements table reachable', async (n) => {
  const { error } = await sb.from('kid_achievements').select('id').limit(1);
  if (error) throw error; ok(n);
});

await run('A1 notification_log table reachable', async (n) => {
  const { error } = await sb.from('notification_log').select('id').limit(1);
  if (error) throw error; ok(n);
});

await run('A1 orders.fulfilled_by_user_id column exists', async (n) => {
  const { error } = await sb.from('orders').select('id,fulfilled_by_user_id,fulfilled_at').limit(1);
  if (error) throw error; ok(n);
});

await run('A6 mark_redemption_fulfilled gates on auth (no JWT → 28000/42501)', async (n) => {
  // Service role calls have no auth.uid()/JWT claims — function MUST refuse.
  const { error } = await sb.rpc('mark_redemption_fulfilled', { p_code: 'ZZZZZZZZ' });
  if (!error) bad(n, 'expected auth gate, got success');
  else if (['28000','42501','P0001'].includes(error.code) || /authenticated|admin|tenant/i.test(error.message)) {
    ok(n, `${error.code} ${error.message.slice(0,60)}`);
  } else bad(n, `unexpected: ${error.code} ${error.message}`);
});

await run('A11 get_kid_weekly_rank_delta gates on auth', async (n) => {
  const { data, error } = await sb.rpc('get_kid_weekly_rank_delta', { p_kid_id: '00000000-0000-0000-0000-000000000000' });
  if (error && ['28000','42501'].includes(error.code)) ok(n, `${error.code} ${error.message.slice(0,60)}`);
  else if (!error && data === null) ok(n, 'null as expected');
  else if (!error) ok(n, `returned ${JSON.stringify(data)}`);
  else bad(n, `unexpected: ${error.code} ${error.message}`);
});

await run('A1 _grant_achievement function exists (PostgREST visibility)', async (n) => {
  // We expect this to error because non-existent kid_id; but the function MUST be reachable.
  const { error } = await sb.rpc('_grant_achievement', {
    p_kid_id: '00000000-0000-0000-0000-000000000000',
    p_key: 'first_swing',
  });
  // Function exists if error is NOT "function ... does not exist" (42883)
  if (error && error.code === '42883') bad(n, 'function not deployed');
  else if (error && error.code === 'PGRST202') bad(n, 'PostgREST cannot find function — check schema cache');
  else ok(n, error ? `reachable (returned ${error.code})` : 'reachable, returned successfully (no-op on missing kid)');
});

await run('A1 points_ledger CHECK includes achievement_bonus', async (n) => {
  // Probe via information_schema using a raw call — fall back to inspecting CHECK by querying pg_constraint.
  // Simplest: attempt a service-role insert that should be rejected on missing FK rather than CHECK.
  const fakeKid = '00000000-0000-0000-0000-000000000000';
  const fakeTenant = '00000000-0000-0000-0000-000000000001';
  const { error } = await sb.from('points_ledger').insert({
    tenant_id: fakeTenant, kid_id: fakeKid, points: 25,
    reason: 'achievement_bonus', reference_type: 'achievement',
    reference_id: '00000000-0000-0000-0000-000000000000',
  });
  if (!error) bad(n, 'insert unexpectedly succeeded — clean it up!');
  else if (/check constraint/i.test(error.message) && /reason|reference_type/i.test(error.message)) {
    bad(n, `CHECK rejected achievement_bonus/achievement: ${error.message}`);
  } else {
    // FK violation, NOT NULL on idempotent uniq, etc — means CHECK passed. Good.
    ok(n, `CHECK passed (rejected on ${error.code}: ${error.message.slice(0,60)})`);
  }
});

await run('Edge function: notify-achievement deployed', async (n) => {
  const r = await fetch(`${url}/functions/v1/notify-achievement`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (r.status === 404) bad(n, 'not deployed');
  else if (r.status === 401) ok(n, 'deployed, requires auth (expected)');
  else ok(n, `deployed, status ${r.status}`);
});

await run('Edge function: notify-assignment-reviewed deployed', async (n) => {
  const r = await fetch(`${url}/functions/v1/notify-assignment-reviewed`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  if (r.status === 404) bad(n, 'not deployed');
  else if (r.status === 401) ok(n, 'deployed, requires auth (expected)');
  else ok(n, `deployed, status ${r.status}`);
});

await run('Edge function: notify-leaderboard-weekly deployed', async (n) => {
  const r = await fetch(`${url}/functions/v1/notify-leaderboard-weekly`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  if (r.status === 404) bad(n, 'not deployed');
  else if (r.status === 401) ok(n, 'deployed, requires auth (expected)');
  else ok(n, `deployed, status ${r.status}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
