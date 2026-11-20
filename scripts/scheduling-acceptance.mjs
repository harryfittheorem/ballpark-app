/**
 * Explicit development-only acceptance fixtures. No purchases or refunds.
 * Requires an already authenticated Supabase CLI linked to the approved target.
 * Credentials stay in a mode-0600 temporary file, never in logs or Git.
 *
 * node scripts/scheduling-acceptance.mjs seed --development-only
 * node scripts/scheduling-acceptance.mjs api /tmp/<fixture-file>
 * node scripts/scheduling-acceptance.mjs check /tmp/<fixture-file>
 * node scripts/scheduling-acceptance.mjs close /tmp/<fixture-file>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const project = 'exjcwvvglthnxerzpukw';
const url = `https://${project}.supabase.co`;
if (readFileSync('supabase/.temp/project-ref', 'utf8').trim() !== project) throw Error('Unexpected database target');
function cli(args) {
  const result = spawnSync('npx', ['--no-install', 'supabase', ...args], { encoding: 'utf8', timeout: 45000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw Error((result.stderr || 'Supabase command failed').slice(0, 2000));
  const data = JSON.parse(result.stdout);
  return data.rows ?? data;
}
const query = sql => cli(['db', 'query', '--linked', '--output', 'json', '--', sql]);
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const keys = cli(['projects', 'api-keys', '--project-ref', project, '--output', 'json']);
const serviceKey = keys.find(key => key.name === 'service_role')?.api_key;
const anonKey = keys.find(key => key.name === 'anon')?.api_key;
if (!serviceKey || !anonKey) throw Error('Authenticated project API access is required');
async function request(path, { body, method = 'POST', token = serviceKey } = {}) {
  const response = await fetch(`${url}${path}`, {
    method, headers: { apikey: serviceKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Error(`Supabase request failed (${response.status}): ${path.split('?')[0]} ${data?.code ?? ''}`);
  return data;
}
async function signIn(account) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  if (!response.ok) throw Error(`Fixture sign-in failed (${response.status})`);
  return (await response.json()).access_token;
}
async function rpc(name, body, token) {
  return request(`/rest/v1/rpc/${name}`, { body, token });
}
function assert(condition, message) { if (!condition) throw Error(message); }
async function assertRawInsertDenied(f, token, start) {
  const end = new Date(new Date(start).getTime() + 30 * 60000).toISOString();
  const response = await fetch(`${url}/rest/v1/bookings`, {
    method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: f.tenant, location_id: f.location, kid_id: f.apiKid, session_type_id: f.lesson,
      scheduled_start: start, scheduled_end: end, status: 'confirmed' }),
  });
  assert(response.status === 403, 'Raw parent insertion was not denied by database permissions');
}
const [operation, argument] = process.argv.slice(2);

if (operation === 'seed') {
  if (argument !== '--development-only') throw Error('Explicit --development-only confirmation is required');
  const suffix = randomUUID().slice(0, 8);
  const f = {
    tenant: randomUUID(), location: randomUUID(), otherLocation: randomUUID(),
    kid: randomUUID(), lesson: randomUUID(), rental: randomUUID(), group: randomUUID(),
    coach: randomUUID(), secondCoach: randomUUID(), slug: `r06-acceptance-${suffix}`,
    athleteName: `R06 Athlete ${suffix}`, lessonName: `R06 Hitting Lesson ${suffix}`, suffix,
    accounts: {},
  };
  const fixturePath = `/tmp/r06-acceptance-${suffix}.json`;
  const save = () => writeFileSync(fixturePath, JSON.stringify(f), { mode: 0o600 });
  save();
  query(`BEGIN;
    INSERT INTO tenants(id,name,slug) VALUES('${f.tenant}','R06 TEST ONLY ${suffix}','${f.slug}');
    INSERT INTO locations(id,tenant_id,name,timezone) VALUES
      ('${f.location}','${f.tenant}','R06 Test Location','UTC'),('${f.otherLocation}','${f.tenant}','R06 Other Location','UTC');
    INSERT INTO tenant_config(tenant_id) VALUES('${f.tenant}');
    COMMIT;`);
  for (const [name, role] of [['owner', 'owner'], ['admin', 'admin'], ['otherAdmin', 'admin'], ['parent', 'parent']]) {
    const account = { email: `r06-${name.toLowerCase()}-${suffix}@ballpark.test`, password: randomBytes(24).toString('base64url') };
    const created = await request('/auth/v1/admin/users', { body: {
      email: account.email, password: account.password, email_confirm: true,
      user_metadata: { app_role: role, tenant_slug: f.slug, location_id: f.location, first_name: 'R06', last_name: `Test ${name}` },
    } });
    account.id = created.id; f.accounts[name] = account; save();
  }
  const family = query(`SELECT id FROM families WHERE parent_user_id='${f.accounts.parent.id}' AND tenant_id='${f.tenant}';`)[0]?.id;
  assert(family, 'Synthetic family was not provisioned');
  f.family = family;
  query(`BEGIN;
    INSERT INTO staff_locations(user_id,tenant_id,location_id) VALUES
      ('${f.accounts.admin.id}','${f.tenant}','${f.location}'),('${f.accounts.otherAdmin.id}','${f.tenant}','${f.otherLocation}');
    INSERT INTO kids(id,family_id,first_name,last_name,date_of_birth) VALUES('${f.kid}','${family}','R06','Athlete ${suffix}','2010-01-01');
    INSERT INTO coaches(id,tenant_id,primary_location_id,first_name,last_name) VALUES
      ('${f.coach}','${f.tenant}','${f.location}','R06','Instructor One'),
      ('${f.secondCoach}','${f.tenant}','${f.location}','R06','Instructor Two');
    INSERT INTO coach_locations(coach_id,location_id) VALUES('${f.coach}','${f.location}'),('${f.secondCoach}','${f.location}');
    INSERT INTO coach_availability(tenant_id,coach_id,location_id,day_of_week,start_time,end_time)
      SELECT '${f.tenant}','${f.coach}','${f.location}',day,'00:00','23:59' FROM generate_series(0,6) day;
    INSERT INTO session_types(id,tenant_id,name,type_category,duration_minutes,capacity) VALUES
      ('${f.lesson}','${f.tenant}','${f.lessonName}','private',30,2),
      ('${f.rental}','${f.tenant}','R06 Cage Rental ${suffix}','cage',30,2),
      ('${f.group}','${f.tenant}','R06 Event Type ${suffix}','group',60,10);
    INSERT INTO memberships(tenant_id,family_id,kid_id,plan_name,plan_type,amount_cents,status,sessions_total,sessions_remaining)
      VALUES('${f.tenant}','${family}','${f.kid}','R06 TEST CREDIT ONLY','otc',0,'active',30,30);
    COMMIT;`);
  const token = await signIn(f.accounts.owner);
  f.membership = query(`SELECT id FROM memberships WHERE kid_id='${f.kid}' AND tenant_id='${f.tenant}';`)[0].id;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert(claims.app_role === 'owner' && claims.tenant_id === f.tenant, 'Fixture JWT is not scoped to the test tenant');
  await rpc('set_manual_location_capacity', { p_location_id: f.location, p_lesson_capacity: 2, p_rental_capacity: 1 }, token);
  for (const cage of ['A', 'B']) await rpc('set_scheduling_resource', {
    p_location_id: f.location, p_cage_number: cage, p_purpose: 'both', p_active: true, p_reason: 'Synthetic acceptance fixture only',
  }, token);
  const starts = new Date(Date.now() + 2 * 3600000); starts.setUTCMinutes(0, 0, 0);
  f.when = starts.toISOString().slice(0, 16);
  save();
  console.log(JSON.stringify({ fixturePath, tenant: f.tenant, athleteName: f.athleteName, lessonName: f.lessonName, whenUTC: f.when }));
} else if (operation === 'api') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  f.apiKid ??= randomUUID();
  writeFileSync(argument, JSON.stringify(f), { mode: 0o600 });
  query(`BEGIN;
    INSERT INTO kids(id,family_id,first_name,last_name) VALUES('${f.apiKid}','${f.family}','R06 API','Athlete ${f.suffix}') ON CONFLICT(id) DO NOTHING;
    INSERT INTO memberships(tenant_id,family_id,kid_id,plan_name,plan_type,amount_cents,status,sessions_total,sessions_remaining)
      SELECT '${f.tenant}','${f.family}','${f.apiKid}','R06 API TEST CREDIT ONLY','otc',0,'active',20,20
      WHERE NOT EXISTS(SELECT 1 FROM memberships WHERE kid_id='${f.apiKid}');
    INSERT INTO coach_locations(coach_id,location_id) VALUES('${f.secondCoach}','${f.otherLocation}') ON CONFLICT DO NOTHING;
    INSERT INTO coach_availability(tenant_id,coach_id,location_id,day_of_week,start_time,end_time)
      SELECT '${f.tenant}','${f.secondCoach}','${f.otherLocation}',day,'00:00','23:59' FROM generate_series(0,6) day;
    INSERT INTO coach_availability(tenant_id,coach_id,location_id,day_of_week,start_time,end_time,effective_until)
      SELECT '${f.tenant}','${f.secondCoach}','${f.location}',day,'00:00','23:59',current_date-1 FROM generate_series(0,6) day;
    COMMIT;`);
  const parent = await signIn(f.accounts.parent), owner = await signIn(f.accounts.owner), other = await signIn(f.accounts.otherAdmin);
  // A previous interrupted API pass may have left its own future reservations.
  // Cancel only this API-only test athlete's rows via the authorized policy RPC.
  for (const row of query(`SELECT id FROM bookings WHERE kid_id='${f.apiKid}' AND tenant_id='${f.tenant}' AND status='confirmed';`)) {
    await rpc('cancel_booking', { p_booking_id: row.id, p_reason: 'Restart synthetic API acceptance', p_override: true }, owner);
  }
  const athletes = await request(`/rest/v1/kids?select=id,families!inner(tenant_id,primary_location_id)&id=eq.${f.kid}&families.tenant_id=eq.${f.tenant}`, { method: 'GET', token: owner });
  assert(athletes.length === 1, 'Owner athlete search relation was not accessible under RLS');
  const when = (days, hour = 12) => {
    const date = new Date(); date.setUTCDate(date.getUTCDate() + days); date.setUTCHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const params = (type, start, key = randomUUID()) => ({
    p_kid_id: f.apiKid, p_location_id: f.location, p_session_type_id: type,
    p_scheduled_start: start, p_request_id: key, p_coach_id: f.secondCoach,
  });
  const balance = () => query(`SELECT sessions_remaining FROM memberships WHERE kid_id='${f.apiKid}';`)[0].sessions_remaining;
  const duplicateParams = params(f.lesson, when(2));
  const before = balance();
  const duplicate = await Promise.all([rpc('create_customer_booking', duplicateParams, parent), rpc('create_customer_booking', duplicateParams, parent)]);
  assert(duplicate[0].booking.id === duplicate[1].booking.id && balance() === before - 1, 'Concurrent customer replay duplicated credits or booking');
  assert(duplicate[0].booking.coach_id === f.coach, 'Expired/other-location availability influenced coach allocation');
  const rental = await rpc('create_customer_booking', params(f.rental, when(2, 14)), parent);
  assert(['A', 'B'].includes(rental.booking.cage_number), 'Rental did not receive a configured cage');
  async function attempt(name, body, token) {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, data: await response.json() };
  }
  const preRace = balance();
  const races = await Promise.all([attempt('create_customer_booking', params(f.rental, when(3)), parent), attempt('create_customer_booking', params(f.rental, when(3)), parent)]);
  assert(races.filter(result => result.ok).length === 1 && balance() === preRace - 1, 'Final rental slot race was not atomic');
  const denied = await attempt('create_staff_booking', {
    p_kid_id: f.apiKid, p_location_id: f.location, p_session_type_id: f.lesson,
    p_scheduled_start: when(4), p_scheduled_end: when(4, 13), p_request_id: randomUUID(),
  }, other);
  assert(!denied.ok && denied.data.message.includes('PERMISSION_DENIED'), 'Other-location admin created a booking');
  const group = await attempt('create_customer_booking', params(f.group, when(4)), parent);
  assert(!group.ok && group.data.message.includes('event_or_appointment_workflow_required'), 'Generic customer booking bypassed camp workflow');
  const patch = await fetch(`${url}/rest/v1/bookings?id=eq.${rental.booking.id}`, {
    method: 'PATCH', headers: { apikey: anonKey, Authorization: `Bearer ${parent}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  assert(!patch.ok, 'Raw parent cancellation remained available');
  await assertRawInsertDenied(f, parent, when(8));
  const publicBooking = await rpc('create_public_booking', {
    p_tenant_slug: f.slug, p_coach_id: null, p_location_id: f.location, p_session_type_id: f.lesson,
    p_kid_id: f.apiKid, p_scheduled_start: when(5), p_request_id: randomUUID(),
  }, parent);
  assert(Array.isArray(publicBooking) && publicBooking[0]?.booking_id, 'Public booking still required a named coach');
  const waitlist = randomUUID();
  query(`INSERT INTO booking_waitlist(id,tenant_id,session_slot_key,kid_id,family_id,coach_id,session_type_id,location_id,
    scheduled_start,scheduled_end,position,status,claim_deadline) VALUES('${waitlist}','${f.tenant}','r06-${waitlist}',
    '${f.apiKid}','${f.family}','${f.coach}','${f.rental}','${f.location}',${quote(when(6))},${quote(when(6))}::timestamptz+interval '30 minutes',1,'notified',now()+interval '2 hours');`);
  const claim = await rpc('claim_waitlist_spot', { p_waitlist_id: waitlist }, parent);
  const reclaimed = await rpc('claim_waitlist_spot', { p_waitlist_id: waitlist }, parent);
  assert(claim.code === 'OK' && reclaimed.booking_id === claim.booking_id, 'Waitlist replay did not return the same booking');
  const roster = await rpc('get_staff_checkin_roster', { p_start: when(6, 0), p_end: when(6, 23) }, owner);
  assert(roster.some(row => row.id === claim.booking_id), 'Claimed waitlist booking was missing from staff roster');
  const original = balance();
  query(`UPDATE memberships SET sessions_remaining=0 WHERE kid_id='${f.apiKid}';`);
  const noCredit = await attempt('create_customer_booking', params(f.lesson, when(7)), parent);
  query(`UPDATE memberships SET sessions_remaining=${original} WHERE kid_id='${f.apiKid}';`);
  assert(!noCredit.ok && noCredit.data.message.includes('no_session_credits'), 'Existing credit rule was bypassed');
  console.log('PASS: authenticated customer/public booking, coach availability scope, duplicate/final-slot races, rental assignment, waitlist replay, raw-write denial and credit enforcement.');
} else if (operation === 'legacy-rentals') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const owner = await signIn(f.accounts.owner), parent = await signIn(f.accounts.parent);
  await rpc('set_manual_location_capacity', { p_location_id: f.location, p_lesson_capacity: 2, p_rental_capacity: 2 }, owner);
  const start = new Date(`${f.when}Z`), future = new Date(start); future.setUTCDate(future.getUTCDate() + 10);
  const args = {
    p_tenant_id: f.tenant, p_location_id: f.location, p_kid_id: f.kid, p_coach_id: f.coach,
    p_session_type_id: f.rental, p_scheduled_start: future.toISOString(),
    p_scheduled_end: new Date(future.getTime() + 1800000).toISOString(),
    p_guest_name: 'R06 Synthetic Rental Friend', p_request_id: randomUUID(),
  };
  const credit = () => query(`SELECT sessions_remaining FROM memberships WHERE id='${f.membership}';`)[0].sessions_remaining;
  const before = credit();
  const pair = await Promise.all([rpc('book_session_with_friend', args, parent), rpc('book_session_with_friend', args, parent)]);
  assert(pair[0].primary_booking_id === pair[1].primary_booking_id && credit() === before - 2, 'Rental friend replay duplicated credits');
  f.friendIds = [pair[0].primary_booking_id, pair[0].guest_booking_id];
  assert(query(`SELECT count(DISTINCT cage_number) cages FROM bookings WHERE id IN('${f.friendIds[0]}','${f.friendIds[1]}');`)[0].cages === 2,
    'Rental friend pair did not receive two distinct cages');
  const blocked = await rpc('create_staff_booking', {
    p_kid_id: f.kid, p_location_id: f.location, p_session_type_id: f.rental,
    p_scheduled_start: start.toISOString(), p_scheduled_end: new Date(start.getTime() + 1800000).toISOString(),
    p_cage_number: 'A', p_notes: 'Synthetic member resource conflict', p_request_id: randomUUID(),
  }, owner);
  f.blockingRental = blocked.id;
  const preFailure = credit(), bonus = query(`SELECT points_balance FROM kids WHERE id='${f.kid}';`)[0].points_balance;
  let rejected = false;
  try {
    await rpc('book_session_with_friend', {
      ...args, p_scheduled_start: start.toISOString(), p_scheduled_end: new Date(start.getTime() + 1800000).toISOString(), p_request_id: randomUUID(),
    }, parent);
  } catch { rejected = true; }
  assert(rejected && credit() === preFailure && query(`SELECT points_balance FROM kids WHERE id='${f.kid}';`)[0].points_balance === bonus,
    'Unavailable rental pair left a partial credit or bonus change');
  assert(query(`SELECT count(*) bookings FROM bookings WHERE tenant_id='${f.tenant}' AND scheduled_start=${quote(start.toISOString())};`)[0].bookings === 1,
    'Unavailable rental pair left half a booking');
  writeFileSync(argument, JSON.stringify(f), { mode: 0o600 });
  console.log(JSON.stringify({ pass: true, membership: f.membership, when: f.when, athlete: f.athleteName, expectedUiCage: 'B', creditsBeforeUi: credit() }));
} else if (operation === 'legacy-check') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const rows = query(`SELECT cage_number,notes,attended_at,status FROM bookings
    WHERE tenant_id='${f.tenant}' AND kid_id='${f.kid}' AND scheduled_start=${quote(`${f.when}Z`)} ORDER BY cage_number;`);
  assert(rows.length === 2 && rows[0].cage_number === 'A' && rows[1].cage_number === 'B'
    && rows.every(row => row.status === 'confirmed' && row.attended_at === null), 'Member-detail rental did not persist exactly once');
  assert(rows[1].notes === 'Synthetic member rental acceptance', 'Member booking notes were not retained');
  assert(query(`SELECT sessions_remaining FROM memberships WHERE id='${f.membership}';`)[0].sessions_remaining === 26, 'Member rental/replay consumed unexpected credits');
  assert(query(`SELECT count(*) FROM booking_friend_requests WHERE tenant_id='${f.tenant}';`)[0].count === 1, 'Failed friend pair left a receipt');
  const bonus = query(`SELECT count(*) entries,COALESCE(sum(delta),0) points FROM points_ledger
    WHERE kid_id='${f.kid}' AND reason='bring_a_friend' AND reference_id='${f.friendIds[0]}';`)[0];
  assert(bonus.entries === 1 && bonus.points === 100, 'Rental friend replay duplicated its bonus');
  console.log('PASS: persisted member-detail Cage B, no duplicate/attendance, two-cage friend pair and exact credit deductions.');
} else if (operation === 'raw') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const start = new Date(Date.now() + 14 * 86400000).toISOString();
  await assertRawInsertDenied(f, await signIn(f.accounts.parent), start);
  console.log('PASS: authenticated raw booking INSERT is denied (403), preventing credit bypass.');
} else if (operation === 'guard-draft') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const owner = await signIn(f.accounts.owner);
  const start = new Date(); start.setUTCDate(start.getUTCDate() + 12); start.setUTCHours(10, 0, 0, 0);
  const name = `R06 Archive Guard ${randomUUID().slice(0, 6)}`;
  const id = await rpc('save_camp_draft', {
    p_event_id: null, p_location_id: f.location, p_name: name, p_category: 'clinic',
    p_session_type_id: f.group, p_capacity: 2, p_days: [{
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3600000).toISOString(), cage_number: null,
    }], p_request_id: randomUUID(), p_expected_version: null,
  }, owner);
  console.log(JSON.stringify({ id, name }));
} else if (operation === 'realtime') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const token = await signIn(f.accounts.admin), owner = await signIn(f.accounts.owner);
  const db = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: WebSocket } });
  await db.realtime.setAuth(token);
  let resolveEvent;
  const changed = new Promise(resolve => { resolveEvent = resolve; });
  const channel = db.channel(`r06-probe-${randomUUID()}`).on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'bookings', filter: `tenant_id=eq.${f.tenant}`,
  }, event => resolveEvent(event.new.id));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Realtime subscription timeout')), 15000);
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(); }
        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { clearTimeout(timer); reject(Error(`Realtime status: ${status}`)); }
      });
    });
    const start = new Date(); start.setUTCDate(start.getUTCDate() + 1); start.setUTCHours(11, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000), began = Date.now();
    const booking = await rpc('create_staff_booking', {
      p_kid_id: f.apiKid, p_location_id: f.location, p_session_type_id: f.lesson,
      p_scheduled_start: start.toISOString(), p_scheduled_end: end.toISOString(), p_request_id: randomUUID(),
    }, owner);
    let timer;
    const received = await Promise.race([changed, new Promise(resolve => { timer = setTimeout(() => resolve(null), 12000); })]);
    clearTimeout(timer);
    console.log(JSON.stringify({ subscribed: true, insertReceived: received === booking.id, elapsedMs: Date.now() - began }));
  } finally { await db.removeAllChannels(); db.realtime.disconnect(); }
} else if (operation === 'undo-proof') {
  const f = JSON.parse(readFileSync(argument, 'utf8')), token = await signIn(f.accounts.admin);
  const booking = query(`SELECT id FROM bookings WHERE tenant_id='${f.tenant}' AND kid_id='${f.kid}' AND status='confirmed';`)[0];
  assert(booking, 'Missing original UI booking');
  const creditBefore = query(`SELECT sessions_remaining FROM memberships WHERE kid_id='${f.kid}';`)[0].sessions_remaining;
  await rpc('record_booking_attendance', { p_booking_id: booking.id, p_action: 'checkin', p_actual_coach_id: f.coach }, token);
  await rpc('record_booking_attendance', { p_booking_id: booking.id, p_action: 'undo' }, token);
  const result = query(`SELECT b.status,b.actual_coach_id,b.attended_at,
    (SELECT count(*) FROM sessions WHERE booking_id=b.id) sessions,
    (SELECT count(*) FROM points_ledger WHERE kid_id=b.kid_id AND reference_type='booking' AND reference_id=b.id AND reason IN('weekly_visit_bonus','session_attended')) attendance_points,
    (SELECT sessions_remaining FROM memberships WHERE kid_id=b.kid_id) credits
    FROM bookings b WHERE id='${booking.id}';`)[0];
  assert(result.status === 'confirmed' && result.actual_coach_id === null && result.attended_at === null
    && result.sessions === 0 && result.attendance_points === 0 && result.credits === creditBefore, 'Attendance undo regression');
  console.log('PASS: real-schema attendance undo reverses weekly visit points, clears linked session/actual instructor and preserves credits.');
} else if (operation === 'check') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  const rows = query(`SELECT b.id,b.status,b.actual_coach_id,b.attended_at,b.coach_id,b.scheduled_start,
    (SELECT count(*) FROM sessions s WHERE s.booking_id=b.id)::int AS linked_sessions
    FROM bookings b WHERE b.tenant_id=${quote(f.tenant)} ORDER BY b.created_at;`);
  const owner = await signIn(f.accounts.owner);
  const admin = await signIn(f.accounts.admin);
  const other = await signIn(f.accounts.otherAdmin);
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const params = { p_start: start.toISOString(), p_end: end.toISOString() };
  const ownerRoster = await rpc('get_staff_checkin_roster', params, owner);
  const adminRoster = await rpc('get_staff_checkin_roster', params, admin);
  const otherRoster = await rpc('get_staff_checkin_roster', params, other);
  assert(ownerRoster.length > 0 && adminRoster.length === ownerRoster.length, 'Saved booking missing from authorized roster');
  assert(otherRoster.length === 0, 'Cross-location roster leak');
  const history = query(`SELECT h.previous_coach_id,h.actual_coach_id,h.actor_id,h.reason
    FROM booking_instructor_history h JOIN bookings b ON b.id=h.booking_id
    WHERE b.tenant_id=${quote(f.tenant)} AND b.kid_id=${quote(f.kid)} ORDER BY h.recorded_at;`);
  assert(history.some(row => row.previous_coach_id === f.coach && row.actual_coach_id === f.secondCoach
    && row.actor_id === f.accounts.owner.id && row.reason === 'Synthetic acceptance instructor correction'),
  'Actual-instructor correction history was not preserved');
  const points = query(`SELECT k.points_balance,
    (SELECT COALESCE(sum(delta),0) FROM points_ledger WHERE kid_id=k.id) ledger_balance,
    (SELECT count(*) FROM points_ledger p JOIN bookings b ON b.id=p.reference_id
      WHERE p.kid_id=k.id AND p.reference_type='booking' AND p.reason IN('weekly_visit_bonus','session_attended')
      AND b.status='confirmed' AND b.attended_at IS NULL) stale_attendance_points
    FROM kids k WHERE k.id=${quote(f.kid)};`)[0];
  assert(points.points_balance === points.ledger_balance && points.stale_attendance_points === 0, 'Undo did not reverse attendance points consistently');
  const events = query(`SELECT id,name,status,sales_enabled FROM camp_events WHERE tenant_id=${quote(f.tenant)};`);
  assert(events.every(event => !event.sales_enabled), 'Camp sales must remain disabled');
  console.log(JSON.stringify({ bookings: rows, ownerRosterCount: ownerRoster.length, adminRosterCount: adminRoster.length, otherLocationRosterCount: otherRoster.length, correctionAuditVerified: true, undoPointsVerified: true, campDrafts: events }, null, 2));
} else if (operation === 'close') {
  const f = JSON.parse(readFileSync(argument, 'utf8'));
  for (const account of Object.values(f.accounts)) await request(`/auth/v1/admin/users/${account.id}`, { method: 'PUT', body: { ban_duration: '87600h' } });
  query(`UPDATE coaches SET is_active=false WHERE tenant_id=${quote(f.tenant)};
    UPDATE memberships SET status='cancelled' WHERE tenant_id=${quote(f.tenant)};`);
  unlinkSync(argument);
  console.log('Synthetic accounts disabled; temporary credentials removed. Test-tenant audit rows retained.');
} else {
  console.log('Use seed --development-only, api/check <temporary-fixture-file>, or close <temporary-fixture-file>.');
}
