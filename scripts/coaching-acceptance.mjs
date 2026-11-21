/**
 * Development-only R07 fixtures and authenticated acceptance checks.
 * Reuses the scheduling fixture, never customer accounts. Temporary
 * credentials are mode 0600, never logged; close disables accounts.
 *
 * node scripts/coaching-acceptance.mjs seed --development-only
 * node scripts/coaching-acceptance.mjs api <temporary-fixture>
 * node scripts/coaching-acceptance.mjs inspect <temporary-fixture>
 * node scripts/scheduling-acceptance.mjs close <temporary-fixture>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const project = 'exjcwvvglthnxerzpukw';
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project) throw Error('Unexpected development target');
function cli(args) {
  const r = spawnSync('npx', ['--no-install', 'supabase', ...args], { encoding: 'utf8', timeout: 45000 });
  if (r.status !== 0) throw Error(`Supabase command failed: ${r.stderr.slice(0, 500)}`);
  const d = JSON.parse(r.stdout);
  return d.rows ?? d;
}
const query = sql => cli(['db', 'query', '--linked', '--output', 'json', '--', sql]);
const q = s => `'${String(s).replaceAll("'", "''")}'`;
const keys = cli(['projects', 'api-keys', '--project-ref', project, '--output', 'json']);
const anon = keys.find(k => k.name === 'anon')?.api_key;
const service = keys.find(k => k.name === 'service_role')?.api_key;
if (!anon || !service) throw Error('Authenticated development access required');
const url = `https://${project}.supabase.co`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } };
const admin = createClient(url, service, clientOptions);
const assert = (ok, message) => { if (!ok) throw Error(message); };
async function client(account) {
  const db = createClient(url, anon, clientOptions);
  const { error } = await db.auth.signInWithPassword(account);
  if (error) throw Error('Fixture sign-in failed');
  return db;
}
async function rpc(db, name, args, expectError) {
  const { data, error } = await db.rpc(name, args);
  if (expectError) {
    assert(error && error.message.includes(expectError), `${name} should reject ${expectError}: ${error?.message}`);
    return;
  }
  if (error) throw Error(`${name}: ${error.message}`);
  return data;
}
const [operation, arg] = process.argv.slice(2);
if (operation === 'seed') {
  if (arg !== '--development-only') throw Error('Explicit development-only confirmation required');
  const seeded = spawnSync('node', ['scripts/scheduling-acceptance.mjs', 'seed', '--development-only'], { encoding: 'utf8', timeout: 180000 });
  if (seeded.status !== 0) throw Error(seeded.stderr.slice(-1500));
  const { fixturePath } = JSON.parse(seeded.stdout.trim().split('\n').at(-1));
  const f = JSON.parse(readFileSync(fixturePath, 'utf8'));
  f.coachingBooking = randomUUID();
  f.unratedBooking = randomUUID();
  f.checklistCourse = randomUUID();
  f.checklistAssignment = randomUUID();
  const save = () => writeFileSync(fixturePath, JSON.stringify(f), { mode: 0o600 });
  const instructor = {
    email: `r07-instructor-${f.suffix}@ballpark.test`,
    password: randomBytes(24).toString('base64url'),
  };
  const { data: created, error } = await admin.auth.admin.createUser({
    ...instructor, email_confirm: true,
    user_metadata: { app_role: 'coach', tenant_slug: f.slug, location_id: f.location, first_name: 'R07', last_name: 'Instructor' },
  });
  if (error) throw Error('Could not create synthetic instructor');
  instructor.id = created.user.id; f.accounts.instructor = instructor; save();
  const rows = query(`SELECT id FROM coaches WHERE user_id=${q(instructor.id)} AND tenant_id=${q(f.tenant)};`);
  assert(rows.length === 1, 'Coach registration did not create its scoped profile');
  f.authorCoach = rows[0].id;
  save();
  const claims = q(JSON.stringify({ sub: f.accounts.owner.id, tenant_id: f.tenant, app_role: 'owner', role: 'authenticated' }));
  const content = {
    title: 'R07 Phone Checklist Acceptance', description: 'Synthetic assigned training only', category: 'Onboarding',
    lessons: [{ id: 'phone-checklist', title: 'Test assigned checklist', section: 'Training', kind: 'checklist',
      body: '', checklist: ['Review the lesson plan', 'Check training equipment'], managerSignoff: false }],
    questions: [], passingScore: 80, maxAttempts: 3, acknowledgment: '', audience: ['coach','owner','admin'], reviewDate: null,
  };
  query(`BEGIN;
    SELECT set_config('request.jwt.claims',${claims},true);
    UPDATE session_types SET name='Hitting Lesson' WHERE id=${q(f.lesson)} AND tenant_id=${q(f.tenant)};
    UPDATE coaches SET original_hire_date='2021-02-28' WHERE id=${q(f.authorCoach)};
    INSERT INTO coach_locations(coach_id,location_id) VALUES(${q(f.authorCoach)},${q(f.location)}) ON CONFLICT DO NOTHING;
    INSERT INTO bookings(id,tenant_id,location_id,kid_id,coach_id,session_type_id,scheduled_start,scheduled_end,status)
      VALUES(${q(f.coachingBooking)},${q(f.tenant)},${q(f.location)},${q(f.kid)},${q(f.authorCoach)},${q(f.lesson)},
        date_trunc('day',now())+interval '1 minute',date_trunc('day',now())+interval '31 minutes','confirmed'),
      (${q(f.unratedBooking)},${q(f.tenant)},${q(f.location)},${q(f.kid)},${q(f.authorCoach)},${q(f.lesson)},
        date_trunc('day',now())+interval '32 minutes',date_trunc('day',now())+interval '62 minutes','confirmed');
    INSERT INTO training_courses(id,tenant_id,draft,published_version,created_by)
      VALUES(${q(f.checklistCourse)},${q(f.tenant)},${q(JSON.stringify(content))}::jsonb,1,${q(f.accounts.owner.id)});
    INSERT INTO training_revisions(course_id,version,content,published_by)
      VALUES(${q(f.checklistCourse)},1,${q(JSON.stringify(content))}::jsonb,${q(f.accounts.owner.id)});
    INSERT INTO training_assignments(id,tenant_id,course_id,version,user_id,assigned_by)
      VALUES(${q(f.checklistAssignment)},${q(f.tenant)},${q(f.checklistCourse)},1,${q(instructor.id)},${q(f.accounts.owner.id)});
    COMMIT;`);
  const owner = await client(f.accounts.owner);
  for (const id of [f.coachingBooking, f.unratedBooking]) {
    await rpc(owner, 'record_booking_attendance', { p_booking_id: id, p_action: 'checkin', p_actual_coach_id: f.authorCoach });
  }
  console.log(JSON.stringify({ fixturePath, athleteName: f.athleteName, booking: f.coachingBooking, tenant: f.tenant }));
} else if (operation === 'api') {
  const f = JSON.parse(readFileSync(arg, 'utf8'));
  const [owner, author, parent, otherAdmin] = await Promise.all(
    [f.accounts.owner, f.accounts.instructor, f.accounts.parent, f.accounts.otherAdmin].map(client));
  const measurement = { p_request: randomUUID(), p_kind: 'measurement', p_subject: f.coachingBooking,
    p_data: { recorded_on: new Date().toISOString().slice(0,10), average_ev: 67.2, peak_ev: 79.4, unit: 'mph' } };
  const m = await rpc(author, 'save_coaching_record', measurement);
  assert(m.source === 'manual' && m.recorded_by === f.accounts.instructor.id && m.kid_id === f.kid && m.location_id === f.location,
    'Measurement provenance/reference mismatch');
  assert((await rpc(author, 'save_coaching_record', measurement)).id === m.id, 'Measurement retry duplicated');
  const note = { p_request: randomUUID(), p_kind: 'note', p_subject: f.coachingBooking,
    p_data: { recorded_on: new Date().toISOString().slice(0,10), lesson_number: 7, body: 'R07 author-private acceptance note' } };
  await rpc(author, 'save_coaching_record', note);
  const secondDevice = await client(f.accounts.instructor);
  const bundle = await rpc(secondDevice, 'get_staff_coaching_records', { p_booking: f.coachingBooking });
  assert(bundle.notes.length && bundle.measurements.some(row => row.id === m.id), 'Second-device persistence failed');
  assert((await rpc(owner, 'get_staff_coaching_records', { p_booking: f.coachingBooking })).notes.length === 0, 'Owner read another author private note');
  await rpc(parent, 'get_staff_coaching_records', { p_booking: f.coachingBooking }, 'PERMISSION_DENIED');
  await rpc(otherAdmin, 'get_staff_coaching_records', { p_booking: f.coachingBooking }, 'PERMISSION_DENIED');
  for (const db of [parent, owner, otherAdmin]) {
    const { data, error } = await db.from('private_lesson_notes').select('*').eq('booking_id', f.coachingBooking);
    assert(!error && data.length === 0, 'Direct note SELECT bypassed author access');
  }
  const correction = await rpc(author, 'save_coaching_record', { ...measurement, p_request: randomUUID(),
    p_data: { ...measurement.p_data, peak_ev: 80, replaces_id: m.id, correction_reason: 'Explicit acceptance correction' } });
  assert(correction.replaces_id === m.id, 'Correction lost original provenance');
  const { error: rawUpdate } = await admin.from('coaching_measurements').update({ average_ev: 12 }).eq('id', m.id);
  assert(rawUpdate, 'Service importer silently overwrote manual history');
  const game = { p_request: randomUUID(), p_kind: 'game', p_subject: f.kid,
    p_data: { played_on: new Date().toISOString().slice(0,10), at_bats: 4, singles: 1, doubles: 1,
      triples: 0, home_runs: 0, strikeouts: 1, walks: 1, rbis: 2, notes: 'R07 family game' } };
  const g = await rpc(parent, 'save_coaching_record', game);
  assert(g.source === 'self_reported' && g.hits === 2, 'Game provenance/calculation failed');
  await rpc(parent, 'save_coaching_record', { ...game, p_request: randomUUID(), p_data: { ...game.p_data, at_bats: 1 } }, 'check constraint');
  const ratingArgs = { p_booking: f.coachingBooking, p_score: 5, p_comment: 'R07 helpful lesson' };
  const ratings = await Promise.all([rpc(parent, 'rate_coaching_lesson', ratingArgs), rpc(parent, 'rate_coaching_lesson', ratingArgs)]);
  assert(ratings[0].booking_id === ratings[1].booking_id, 'Concurrent ratings duplicated');
  await rpc(parent, 'rate_coaching_lesson', { ...ratingArgs, p_score: 4 }, 'no_edits');
  const day = new Date().toISOString().slice(0,10);
  const report = await rpc(owner, 'get_coaching_report', { p_start: day, p_end: day });
  const row = report.find(r => r.coach_id === f.authorCoach);
  assert(row && row.rated_count === 1 && row.eligible_count === 2 && row.avg_rating === 5 && row.lessons.length === 2, 'Report denominator does not reconcile');
  assert(row.original_hire_date === '2021-02-28' && row.first_anniversary === '2022-02-28', 'Verified hire-date anniversary failed');
  const { data: { session } } = await author.auth.getSession();
  const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const checklists = await fetch(`${base}/api/mobile/checklists`, { headers: { Authorization: `Bearer ${session.access_token}` } });
  assert(checklists.ok, `Phone checklist GET failed (${checklists.status})`);
  assert((await checklists.json()).some(c => c.assignment_id === f.checklistAssignment), 'Assigned phone checklist absent');
  const denied = await fetch(`${base}/api/mobile/checklists`);
  assert(denied.status === 401, 'Phone checklist accepted missing token');
  const parentSession = (await parent.auth.getSession()).data.session;
  const parentDenied = await fetch(`${base}/api/mobile/checklists`, { headers: { Authorization: `Bearer ${parentSession.access_token}` } });
  assert(parentDenied.status === 403, 'Phone checklist accepted family account');
  console.log('PASS: real authenticated independent-device storage, direct note denial, manual correction/import protection, game validation, rating race, hire dates and report coverage; checklist authorization.');
} else if (operation === 'inspect') {
  // Read-only reconciliation after the phone-browser journey. This deliberately
  // does not re-run the initial write/race tests or create additional records.
  const f = JSON.parse(readFileSync(arg, 'utf8'));
  const [owner, author, parent] = await Promise.all(
    [f.accounts.owner, f.accounts.instructor, f.accounts.parent].map(client));
  const bundle = await rpc(author, 'get_staff_coaching_records', { p_booking: f.coachingBooking });
  assert(bundle.measurements.some(m => m.average_ev === 68.3 && m.peak_ev === 81.2 && m.source === 'manual'),
    'Browser measurement missing from server history');
  assert(bundle.notes.some(n => n.lesson_number === 8), 'Browser private note missing');
  const game = bundle.games.find(g => g.notes?.startsWith('R06 family game '));
  assert(game && game.source === 'self_reported' && game.hits === 2 && game.at_bats === 4 &&
    game.singles === 1 && game.doubles === 1 && game.triples === 0 && game.home_runs === 0 &&
    game.strikeouts === 1 && game.walks === 1 && game.rbis === 2, 'Browser game fields or staff visibility failed');
  const { data: rating, error } = await author.from('lesson_ratings')
    .select('booking_id,score,comment,submitted_coach_id,created_at').eq('booking_id', f.unratedBooking).single();
  assert(!error && rating.score === 4 && rating.comment?.startsWith('R06 rating ') &&
    rating.submitted_coach_id === f.authorCoach, 'Instructor cannot read the saved lesson outcome/comment');
  const ownerBundle = await rpc(owner, 'get_staff_coaching_records', { p_booking: f.coachingBooking });
  assert(ownerBundle.notes.length === 0, 'Owner gained author-private notes');
  await rpc(parent, 'get_staff_coaching_records', { p_booking: f.coachingBooking }, 'PERMISSION_DENIED');
  const day = new Date().toISOString().slice(0, 10);
  const row = (await rpc(owner, 'get_coaching_report', { p_start: day, p_end: day }))
    .find(r => r.coach_id === f.authorCoach);
  assert(row?.rated_count === 2 && row.eligible_count === 2 && row.avg_rating === 4.5, 'Final rating coverage does not reconcile');
  const history = await rpc(owner, 'get_player_coaching_history', { p_kid: f.kid, p_page: 1 });
  assert(history.total === 2 && history.rows.length === 2 &&
    history.rows.every(l => l.actual_coach_name && [4, 5].includes(l.rating)), 'Player drilldown lost actual lesson outcomes');
  const { data: { session } } = await author.auth.getSession();
  const response = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/mobile/checklists`,
    { headers: { Authorization: `Bearer ${session.access_token}` } });
  assert(response.ok && (await response.json()).some(c => c.assignment_id === f.checklistAssignment && c.completed),
    'Browser checklist completion was not persisted');
  console.log('PASS: browser-saved measurements, author-private notes, self-reported game fields, instructor rating/comment access, final 4.5 average and 2/2 coverage, player history and persisted checklist completion.');
} else {
  console.log('Use seed --development-only, api or inspect <temporary-fixture>; close with scheduling-acceptance.mjs.');
}
