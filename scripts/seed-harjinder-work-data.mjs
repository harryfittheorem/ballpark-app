#!/usr/bin/env node
// =============================================================================
// scripts/seed-harjinder-work-data.mjs
// =============================================================================
// Seeds dummy Work-tab data for harjinderharry@gmail.com so every sub-tab
// (Swings, Assign, Messages, HW, Drills) shows realistic content.
//
// Usage:
//   node scripts/seed-harjinder-work-data.mjs
//
// Required env:
//   EXPO_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Re-running is a no-op — all inserts use ON CONFLICT DO NOTHING or
// ON CONFLICT ... DO UPDATE on natural idempotency keys.
// =============================================================================

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID    = '00000000-0000-0000-0000-000000000001';
const TARGET_EMAIL = 'harjinderharry@gmail.com';

// Public Mux test asset (same one used by training-videos.sql).
const MUX_TEST_PLAYBACK_ID = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
const MUX_SEED_ASSET_ID    = 'seed-coach-msg-asset-harjinder-001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(2);
}

const headers = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: 'return=representation',
};

async function rest(method, path, body) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function adminGet(path) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, { headers });
  if (!res.ok) throw new Error(`admin GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// 1. Resolve harjinder's user_id
// ---------------------------------------------------------------------------
console.log(`\n→ Looking up ${TARGET_EMAIL}...`);
const listBody = await adminGet(`users?filter=${encodeURIComponent(TARGET_EMAIL)}`);
const targetUser = (listBody?.users || []).find((u) => u.email === TARGET_EMAIL);
if (!targetUser) {
  console.error(`ERROR: No auth user found for ${TARGET_EMAIL}. Has this account been created?`);
  process.exit(1);
}
const parentUserId = targetUser.id;
console.log(`   parent user_id = ${parentUserId}`);

// ---------------------------------------------------------------------------
// 2. Resolve family_id + kid_id
// ---------------------------------------------------------------------------
const families = await rest('GET', `families?tenant_id=eq.${TENANT_ID}&select=id,parent_user_id`);
const family = families.find((f) => f.parent_user_id === parentUserId);
if (!family) {
  console.error('ERROR: No family row found for this user. Has the parent completed signup?');
  process.exit(1);
}
const familyId = family.id;
console.log(`   family_id      = ${familyId}`);

const kids = await rest('GET', `kids?family_id=eq.${familyId}&select=id,first_name`);
if (!kids.length) {
  console.error('ERROR: No kids found for this family. Kid registration must happen first.');
  process.exit(1);
}
const kid = kids[0];
const kidId = kid.id;
console.log(`   kid_id         = ${kidId}  (${kid.first_name})`);

// ---------------------------------------------------------------------------
// 3. Resolve Coach Mike's user_id.
//    Query public.coaches directly by (tenant_id, is_active, first_name, last_name).
//    Coach Mike is the only active coach named Mike Anderson in this tenant.
//    If the name is ambiguous or absent, the script fails explicitly.
//    Fallback: admin-API email lookup for a second confirmation layer.
// ---------------------------------------------------------------------------
console.log('\n→ Resolving Coach Mike...');
const coachRows = await rest(
  'GET',
  `coaches?tenant_id=eq.${TENANT_ID}&is_active=eq.true&first_name=eq.Mike&last_name=eq.Anderson&select=user_id,first_name,last_name`,
);
if (!coachRows.length) {
  // Fall back to email lookup via admin API (covers the case where the name
  // stored in the coaches row differs slightly from the expected value).
  console.log('   (name lookup missed — trying email fallback)');
  const coachEmail = 'coach.mike@infinitehitting.com';
  const coachListBody = await adminGet(`users?filter=${encodeURIComponent(coachEmail)}`);
  const coachAuthUser = (coachListBody?.users || []).find((u) => u.email === coachEmail);
  if (!coachAuthUser) {
    console.error('ERROR: Coach Mike not found by name or email. Run scripts/provision-coach-mike.mjs first.');
    process.exit(1);
  }
  const fallbackRows = await rest(
    'GET',
    `coaches?user_id=eq.${coachAuthUser.id}&tenant_id=eq.${TENANT_ID}&select=user_id,first_name,last_name`,
  );
  if (!fallbackRows.length) {
    console.error('ERROR: Auth user found for coach.mike@infinitehitting.com but no coaches row exists. handle_new_user may not have fired.');
    process.exit(1);
  }
  coachRows.push(...fallbackRows);
}
if (coachRows.length > 1) {
  console.error(`ERROR: ${coachRows.length} active coaches named Mike Anderson found — cannot disambiguate safely.`);
  process.exit(1);
}
const coach = coachRows[0];
const coachUserId = coach.user_id;
console.log(`   coach_user_id  = ${coachUserId}  (${coach.first_name} ${coach.last_name})`);

// ---------------------------------------------------------------------------
// 4. Sessions (3 manual sessions in Oct–Nov 2025)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding sessions...');

const sessionDefs = [
  {
    capture_session_id: 'seed-harjinder-session-001',
    started_at: '2025-10-08T16:00:00Z',
    ended_at:   '2025-10-08T17:15:00Z',
    swing_count: 12,
    best_exit_velocity_mph: 74.2,
    avg_exit_velocity_mph:  67.8,
    max_distance_ft: 262,
    notes: 'Hitting with Coach Mike — tee work and soft toss',
  },
  {
    capture_session_id: 'seed-harjinder-session-002',
    started_at: '2025-10-22T15:30:00Z',
    ended_at:   '2025-10-22T16:45:00Z',
    swing_count: 10,
    best_exit_velocity_mph: 71.5,
    avg_exit_velocity_mph:  65.3,
    max_distance_ft: 248,
    notes: 'Group class — live BP focus',
  },
  {
    capture_session_id: 'seed-harjinder-session-003',
    started_at: '2025-11-05T17:00:00Z',
    ended_at:   '2025-11-05T18:00:00Z',
    swing_count: 10,
    best_exit_velocity_mph: 75.1,
    avg_exit_velocity_mph:  69.4,
    max_distance_ft: 265,
    notes: 'Hitting with Coach Mike — two-strike approach',
  },
];

const sessionRows = sessionDefs.map((s) => ({
  tenant_id:              TENANT_ID,
  kid_id:                 kidId,
  capture_source:         'manual',
  capture_session_id:     s.capture_session_id,
  started_at:             s.started_at,
  ended_at:               s.ended_at,
  swing_count:            s.swing_count,
  best_exit_velocity_mph: s.best_exit_velocity_mph,
  avg_exit_velocity_mph:  s.avg_exit_velocity_mph,
  max_distance_ft:        s.max_distance_ft,
  notes:                  s.notes,
}));

// Insert with conflict-free path: the unique index is on (capture_source, capture_session_id)
// where capture_session_id IS NOT NULL. Use Prefer: resolution=ignore-duplicates.
const sessionRes = await fetch(
  `${SUPABASE_URL}/rest/v1/sessions`,
  {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(sessionRows),
  },
);
const sessionText = await sessionRes.text();
let insertedSessions;
try { insertedSessions = JSON.parse(sessionText); } catch { insertedSessions = []; }
if (!sessionRes.ok && sessionRes.status !== 409) {
  throw new Error(`sessions insert → ${sessionRes.status}: ${sessionText}`);
}

// Fetch all 3 sessions by capture_session_id to get their UUIDs (covers re-run case).
const allSessions = await rest(
  'GET',
  `sessions?kid_id=eq.${kidId}&capture_session_id=in.(seed-harjinder-session-001,seed-harjinder-session-002,seed-harjinder-session-003)&select=id,capture_session_id`,
);
const sessionIdMap = Object.fromEntries(allSessions.map((s) => [s.capture_session_id, s.id]));
console.log(`   sessions: ${Object.keys(sessionIdMap).length}/3 rows present`);

// ---------------------------------------------------------------------------
// 5. Swings (~30 across the 3 sessions)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding swings...');

function makeSwing(sessionKey, eventId, occurredAt, ev, la, dist, isPR = false) {
  return {
    tenant_id:          TENANT_ID,
    kid_id:             kidId,
    session_id:         sessionIdMap[sessionKey],
    capture_source:     'manual',
    capture_event_id:   eventId,
    occurred_at:        occurredAt,
    exit_velocity_mph:  ev,
    launch_angle_deg:   la,
    distance_ft:        dist,
    is_personal_best:   isPR,
  };
}

const swingDefs = [
  // Session 1 — 2025-10-08 (12 swings)
  makeSwing('seed-harjinder-session-001', 'ev-h-001', '2025-10-08T16:05:00Z', 63.4, 14.2, 198),
  makeSwing('seed-harjinder-session-001', 'ev-h-002', '2025-10-08T16:07:00Z', 65.1, 18.7, 210),
  makeSwing('seed-harjinder-session-001', 'ev-h-003', '2025-10-08T16:09:00Z', 58.8, 22.1, 185),
  makeSwing('seed-harjinder-session-001', 'ev-h-004', '2025-10-08T16:11:00Z', 67.3, 11.5, 220),
  makeSwing('seed-harjinder-session-001', 'ev-h-005', '2025-10-08T16:13:00Z', 60.2, 28.4, 192),
  makeSwing('seed-harjinder-session-001', 'ev-h-006', '2025-10-08T16:16:00Z', 69.5, 16.3, 230),
  makeSwing('seed-harjinder-session-001', 'ev-h-007', '2025-10-08T16:19:00Z', 71.0, 19.8, 242),
  makeSwing('seed-harjinder-session-001', 'ev-h-008', '2025-10-08T16:22:00Z', 66.7, 13.1, 218),
  makeSwing('seed-harjinder-session-001', 'ev-h-009', '2025-10-08T16:25:00Z', 62.3, 25.6, 200),
  makeSwing('seed-harjinder-session-001', 'ev-h-010', '2025-10-08T16:28:00Z', 74.2, 17.4, 262, true),
  makeSwing('seed-harjinder-session-001', 'ev-h-011', '2025-10-08T16:31:00Z', 64.8, 9.3,  205),
  makeSwing('seed-harjinder-session-001', 'ev-h-012', '2025-10-08T16:34:00Z', 68.1, 21.0, 225),

  // Session 2 — 2025-10-22 (10 swings)
  makeSwing('seed-harjinder-session-002', 'ev-h-013', '2025-10-22T15:35:00Z', 61.5, 16.8, 196),
  makeSwing('seed-harjinder-session-002', 'ev-h-014', '2025-10-22T15:38:00Z', 63.9, 23.2, 204),
  makeSwing('seed-harjinder-session-002', 'ev-h-015', '2025-10-22T15:41:00Z', 59.7, 30.1, 183),
  makeSwing('seed-harjinder-session-002', 'ev-h-016', '2025-10-22T15:44:00Z', 66.4, 12.7, 217),
  makeSwing('seed-harjinder-session-002', 'ev-h-017', '2025-10-22T15:47:00Z', 70.2, 20.5, 238),
  makeSwing('seed-harjinder-session-002', 'ev-h-018', '2025-10-22T15:50:00Z', 65.8, 14.9, 213),
  makeSwing('seed-harjinder-session-002', 'ev-h-019', '2025-10-22T15:53:00Z', 71.5, 18.3, 248),
  makeSwing('seed-harjinder-session-002', 'ev-h-020', '2025-10-22T15:56:00Z', 67.2, 10.6, 222),
  makeSwing('seed-harjinder-session-002', 'ev-h-021', '2025-10-22T15:59:00Z', 64.1, 26.8, 207),
  makeSwing('seed-harjinder-session-002', 'ev-h-022', '2025-10-22T16:02:00Z', 69.8, 22.4, 233),

  // Session 3 — 2025-11-05 (10 swings, 1 PR on distance)
  makeSwing('seed-harjinder-session-003', 'ev-h-023', '2025-11-05T17:05:00Z', 66.3, 15.2, 219),
  makeSwing('seed-harjinder-session-003', 'ev-h-024', '2025-11-05T17:08:00Z', 68.9, 19.7, 228),
  makeSwing('seed-harjinder-session-003', 'ev-h-025', '2025-11-05T17:11:00Z', 72.4, 13.5, 247),
  makeSwing('seed-harjinder-session-003', 'ev-h-026', '2025-11-05T17:14:00Z', 64.6, 29.3, 202),
  makeSwing('seed-harjinder-session-003', 'ev-h-027', '2025-11-05T17:17:00Z', 70.8, 17.1, 240),
  makeSwing('seed-harjinder-session-003', 'ev-h-028', '2025-11-05T17:20:00Z', 67.5, 11.8, 224),
  makeSwing('seed-harjinder-session-003', 'ev-h-029', '2025-11-05T17:23:00Z', 73.6, 20.9, 252),
  makeSwing('seed-harjinder-session-003', 'ev-h-030', '2025-11-05T17:26:00Z', 75.1, 16.5, 265, true),
  makeSwing('seed-harjinder-session-003', 'ev-h-031', '2025-11-05T17:29:00Z', 69.3, 24.7, 235),
  makeSwing('seed-harjinder-session-003', 'ev-h-032', '2025-11-05T17:32:00Z', 71.9, 8.2,  244),
];

const swingRes = await fetch(
  `${SUPABASE_URL}/rest/v1/swings`,
  {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify(swingDefs),
  },
);
const swingText = await swingRes.text();
let insertedSwings;
try { insertedSwings = JSON.parse(swingText); } catch { insertedSwings = []; }
if (!swingRes.ok && swingRes.status !== 409) {
  throw new Error(`swings insert → ${swingRes.status}: ${swingText}`);
}
const swingCount = Array.isArray(insertedSwings) ? insertedSwings.length : 0;
console.log(`   swings: ${swingCount} inserted (${swingDefs.length - swingCount} already existed)`);

// Fetch the PR swings' IDs so we can reference them in personal_bests
const prSwings = await rest(
  'GET',
  `swings?capture_event_id=in.(ev-h-010,ev-h-030)&select=id,capture_event_id,exit_velocity_mph,distance_ft,occurred_at`,
);
const swingById = Object.fromEntries(prSwings.map((s) => [s.capture_event_id, s]));

// ---------------------------------------------------------------------------
// 6. Personal bests (exit_velocity_mph + distance_ft)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding personal_bests...');

// ev-h-010: exit_velocity_mph 74.2  (session 1)
// ev-h-030: distance_ft 265         (session 3)
const prRows = [
  {
    tenant_id:   TENANT_ID,
    kid_id:      kidId,
    metric:      'exit_velocity_mph',
    value:       74.2,
    swing_id:    swingById['ev-h-010']?.id ?? null,
    achieved_at: '2025-10-08T16:28:00Z',
  },
  {
    tenant_id:   TENANT_ID,
    kid_id:      kidId,
    metric:      'distance_ft',
    value:       265,
    swing_id:    swingById['ev-h-030']?.id ?? null,
    achieved_at: '2025-11-05T17:26:00Z',
  },
];

// UNIQUE on (kid_id, metric) — upsert to update value if it changed.
const pbRes = await fetch(
  `${SUPABASE_URL}/rest/v1/personal_bests?on_conflict=kid_id,metric`,
  {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: JSON.stringify(prRows),
  },
);
const pbText = await pbRes.text();
if (!pbRes.ok) throw new Error(`personal_bests upsert → ${pbRes.status}: ${pbText}`);
console.log(`   personal_bests: 2 rows upserted (exit_velocity_mph=74.2, distance_ft=265)`);

// ---------------------------------------------------------------------------
// 7. Assignments — 2 pending (Assign tab) + 2 HW (submitted + reviewed)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding assignments...');

const now = new Date().toISOString();
const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

// PostgREST requires all objects in a batch POST to have identical keys.
// Include every nullable column explicitly so the shape is uniform.
const assignmentRows = [
  // Pending #1 — due today (shows as urgent)
  {
    tenant_id:                 TENANT_ID,
    kid_id:                    kidId,
    family_id:                 familyId,
    coach_user_id:             coachUserId,
    title:                     'Tee Work — Hip Drive',
    description:               'Set up on the tee at belt height. Focus on driving your back hip through the ball on every swing. 3 sets of 10 cuts. Record from the front.',
    duration_estimate_minutes: 20,
    due_date:                  today,
    point_reward:              25,
    status:                    'pending',
    submitted_at:              null,
    reviewed_at:               null,
    rating:                    null,
    feedback:                  null,
  },
  // Pending #2 — due next week
  {
    tenant_id:                 TENANT_ID,
    kid_id:                    kidId,
    family_id:                 familyId,
    coach_user_id:             coachUserId,
    title:                     'Two-Strike Approach Practice',
    description:               'Choke up one inch, shorten the stride, and battle. Work through 3 counts of 0-2 against the pitching machine. Focus on putting the ball in play.',
    duration_estimate_minutes: 30,
    due_date:                  nextWeek,
    point_reward:              25,
    status:                    'pending',
    submitted_at:              null,
    reviewed_at:               null,
    rating:                    null,
    feedback:                  null,
  },
  // HW #1 — submitted (parent completed, waiting on coach review)
  {
    tenant_id:                 TENANT_ID,
    kid_id:                    kidId,
    family_id:                 familyId,
    coach_user_id:             coachUserId,
    title:                     'Soft Toss — Opposite Field',
    description:               'Back-side soft toss, driving the ball to the opposite field gap. 3 sets of 8.',
    duration_estimate_minutes: 15,
    due_date:                  '2025-11-01',
    point_reward:              25,
    status:                    'submitted',
    submitted_at:              '2025-11-01T20:14:00Z',
    reviewed_at:               null,
    rating:                    null,
    feedback:                  null,
  },
  // HW #2 — reviewed with 4★ rating
  {
    tenant_id:                 TENANT_ID,
    kid_id:                    kidId,
    family_id:                 familyId,
    coach_user_id:             coachUserId,
    title:                     'Load and Timing Drill',
    description:               'Front-foot timing drill off the tee. Focus on a quiet load, land soft, rotate hard. 4 sets of 8.',
    duration_estimate_minutes: 20,
    due_date:                  '2025-10-20',
    point_reward:              25,
    status:                    'reviewed',
    submitted_at:              '2025-10-20T19:30:00Z',
    reviewed_at:               '2025-10-21T10:45:00Z',
    rating:                    4,
    feedback:                  'Great effort on the timing — I can see you landing soft and rotating through. Next step: keep the hands inside the ball on the outside pitch. Work on that and you\'ll be in great shape.',
  },
];

// No stable natural key on assignments, so we check by (kid_id, title) to avoid duplicates.
// We use a per-title check before inserting.
const existingAssignments = await rest(
  'GET',
  `assignments?kid_id=eq.${kidId}&select=title`,
);
// assignments has no DB-level unique constraint on (kid_id, title), so we
// implement idempotency by checking per-row against (kid_id, coach_user_id, title)
// before inserting. Each row is inserted individually so a partial failure is
// visible and doesn't block unrelated rows.
const existingTitles = new Set((existingAssignments || []).map((a) => a.title));
let insertedCount = 0;
let skippedCount = 0;
for (const row of assignmentRows) {
  if (existingTitles.has(row.title)) {
    skippedCount++;
    continue;
  }
  const aRes = await fetch(
    `${SUPABASE_URL}/rest/v1/assignments`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    },
  );
  const aText = await aRes.text();
  if (!aRes.ok) throw new Error(`assignments insert (${row.title}) → ${aRes.status}: ${aText}`);
  insertedCount++;
}
console.log(`   assignments: ${insertedCount} inserted, ${skippedCount} already existed`);

// ---------------------------------------------------------------------------
// 8. Video row for the coach message thread
// ---------------------------------------------------------------------------
console.log('\n→ Seeding video row for coach message...');

const videoRow = {
  tenant_id:           TENANT_ID,
  uploaded_by_user_id: coachUserId,
  mux_asset_id:        MUX_SEED_ASSET_ID,
  mux_playback_id:     MUX_TEST_PLAYBACK_ID,
  duration_seconds:    45,
  status:              'ready',
  title:               'Swing feedback from Coach Mike',
  purpose:             'coach_message',
};

const vRes = await fetch(
  `${SUPABASE_URL}/rest/v1/videos`,
  {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation,resolution=ignore-duplicates' },
    body: JSON.stringify([videoRow]),
  },
);
const vText = await vRes.text();
if (!vRes.ok && vRes.status !== 409) {
  throw new Error(`videos insert → ${vRes.status}: ${vText}`);
}

// Fetch the video id (inserted or pre-existing) by mux_asset_id.
const videos = await rest('GET', `videos?mux_asset_id=eq.${MUX_SEED_ASSET_ID}&select=id`);
if (!videos.length) {
  throw new Error('Could not retrieve video row after insert.');
}
const videoId = videos[0].id;
console.log(`   video id = ${videoId}`);

// ---------------------------------------------------------------------------
// 9. Coach messages (Messages sub-tab)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding coach_messages...');

// coach_messages has no DB-level unique constraint, so idempotency is
// implemented by checking per natural key before each insert:
//   text message: (sender_user_id, recipient_kid_id, message_text, video_id IS NULL)
//   video message: (sender_user_id, recipient_kid_id, video_id)
// Each row is inserted individually for clear per-row feedback.
const SEED_TEXT_MSG = 'Great session today! Your hip rotation is really coming along. Keep up the great work — see you Thursday.';

const existingMessages = await rest(
  'GET',
  `coach_messages?recipient_kid_id=eq.${kidId}&sender_user_id=eq.${coachUserId}&select=message_text,video_id`,
);
const hasTextMsg  = existingMessages.some(
  (m) => m.video_id === null && m.message_text === SEED_TEXT_MSG,
);
const hasVideoMsg = existingMessages.some((m) => m.video_id === videoId);

let msgInserted = 0;
let msgSkipped  = 0;

if (!hasTextMsg) {
  const mRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coach_messages`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id:            TENANT_ID,
        sender_user_id:       coachUserId,
        recipient_family_id:  familyId,
        recipient_kid_id:     kidId,
        message_text:         SEED_TEXT_MSG,
        video_id:             null,
        viewed_at:            null,
        created_at:           '2025-11-05T19:00:00Z',
      }),
    },
  );
  const mText = await mRes.text();
  if (!mRes.ok) throw new Error(`coach_messages (text) insert → ${mRes.status}: ${mText}`);
  msgInserted++;
} else {
  msgSkipped++;
}

if (!hasVideoMsg) {
  const mRes = await fetch(
    `${SUPABASE_URL}/rest/v1/coach_messages`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({
        tenant_id:            TENANT_ID,
        sender_user_id:       coachUserId,
        recipient_family_id:  familyId,
        recipient_kid_id:     kidId,
        message_text:         null,
        video_id:             videoId,
        viewed_at:            null,
        created_at:           '2025-11-06T10:30:00Z',
      }),
    },
  );
  const mText = await mRes.text();
  if (!mRes.ok) throw new Error(`coach_messages (video) insert → ${mRes.status}: ${mText}`);
  msgInserted++;
} else {
  msgSkipped++;
}

console.log(`   coach_messages: ${msgInserted} inserted, ${msgSkipped} already existed`);

// ---------------------------------------------------------------------------
// 10. Active membership for Harry Singh (Membership screen)
// ---------------------------------------------------------------------------
console.log('\n→ Seeding active membership...');

// Check for an existing active/paused membership for this family+kid.
// memberships has no unique constraint on (family_id, kid_id) so we do a
// manual existence check and skip insert if already present.
const existingMemberships = await rest(
  'GET',
  `memberships?family_id=eq.${familyId}&kid_id=eq.${kidId}&status=in.(active,paused)&select=id,plan_name,status`,
);

if (existingMemberships.length > 0) {
  console.log(`   membership: already exists (${existingMemberships[0].plan_name}, ${existingMemberships[0].status}) — skipped`);
} else {
  const membershipRow = {
    tenant_id:          TENANT_ID,
    family_id:          familyId,
    kid_id:             kidId,
    plan_name:          'Elite Monthly',
    plan_type:          'eft',
    status:             'active',
    amount_cents:       19900,
    billing_anchor_day: 1,
    started_at:         '2025-01-01T00:00:00Z',
    contract_url:       'https://infinitehitting.com/contracts/sample-elite.pdf',
    pause_start:        null,
    pause_end:          null,
  };

  const mbrRes = await fetch(
    `${SUPABASE_URL}/rest/v1/memberships`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(membershipRow),
    },
  );
  const mbrText = await mbrRes.text();
  if (!mbrRes.ok) {
    throw new Error(`memberships insert → ${mbrRes.status}: ${mbrText}`);
  }
  console.log('   membership: inserted (Elite Monthly, $199.00/mo, active, billing anchor day 1)');
}

// ---------------------------------------------------------------------------
// 11. Ensure an upgrade plan exists (amount_cents > 19900 and is_active)
//     The 20260607000000 migration seeds "Elite — Unlimited" at $249/mo.
//     This step is a safety net in case the plans seed hasn't run yet.
// ---------------------------------------------------------------------------
console.log('\n→ Checking for upgrade plan...');

const upgradePlans = await rest(
  'GET',
  `membership_plans?tenant_id=eq.${TENANT_ID}&is_active=eq.true&amount_cents=gt.19900&select=id,name,amount_cents&limit=1`,
);

if (upgradePlans.length > 0) {
  console.log(`   upgrade plan: "${upgradePlans[0].name}" ($${(upgradePlans[0].amount_cents / 100).toFixed(2)}/mo) — already exists`);
} else {
  console.log('   upgrade plan: none found — inserting "Elite Pro" fallback plan...');
  const planRow = {
    tenant_id:    TENANT_ID,
    name:         'Elite Pro',
    plan_type:    'eft',
    amount_cents: 24900,
    description:  'Unlimited private lessons, cage time, and HitTrax session access.',
    sort_order:   10,
    is_active:    true,
  };
  const planRes = await fetch(
    `${SUPABASE_URL}/rest/v1/membership_plans`,
    {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify(planRow),
    },
  );
  const planText = await planRes.text();
  if (!planRes.ok) {
    throw new Error(`membership_plans insert → ${planRes.status}: ${planText}`);
  }
  console.log('   upgrade plan: inserted "Elite Pro" ($249.00/mo)');
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log(`
=============================================================================
DONE — Work tab seed for ${TARGET_EMAIL}
=============================================================================
  Kid:        ${kid.first_name}  (${kidId})
  Family:     ${familyId}
  Coach:      ${coach.first_name} ${coach.last_name}

  Swings tab  3 sessions, 32 swings, 2 PRs (exit_velocity + distance)
  Assign tab  2 pending assignments (1 due today, 1 due next week)
  Messages    1 text message + 1 video message from coach
  HW tab      1 submitted assignment + 1 reviewed assignment (4★ + feedback)
  Drills tab  uses existing training-videos seed (run training-videos.sql if empty)
  Membership  Elite Monthly, $199.00/mo, active, billing anchor day 1
              contract_url set → View Contract link visible
              Upgrade Plan button visible (upgrade plan present at > $199/mo)
=============================================================================
`);
