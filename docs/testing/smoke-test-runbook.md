# Ballpark Smoke Test Runbook

Single source of truth for "does Ballpark still work end-to-end?" Covers every shipped version (v0.1 → v0.6) plus tenant isolation and push notifications. Designed to be copy-pasteable: every command is a real shell or SQL snippet you can paste into Expo Go, `psql`, or `node`.

If you're an IH staff member or beta tester, jump to the [Pre-pilot checklist](#pre-pilot-checklist) at the bottom and work backwards. If you're an engineer running a release smoke before merging to `main`, walk every per-version section in order on a clean install.

---

## Setup

### Tenants

Two tenants are already provisioned in dev:

| Tenant | UUID | Slug |
|---|---|---|
| Infinite Hitting (T1) | `00000000-0000-0000-0000-000000000001` | `infinitehitting` |
| Test Tenant Two (T2)  | `00000000-0000-0000-0000-000000000002` | `test-tenant-two` |

Both tenants ship from the same Expo build. The active tenant is selected by the `EXPO_PUBLIC_TENANT_SLUG` env var in `.env` at build time.

Confirm both tenants exist:

```sql
SELECT id, slug, name FROM public.tenants ORDER BY slug;
-- expect 2 rows
```

### Test accounts

**Human-owned accounts** (passwords held by the owners; do NOT use these for automated probes):

| Email | Tenant | Role | Owner |
|---|---|---|---|
| `coach.mike@infinitehitting.com` | T1 | coach | dev |
| `harjinderharry@gmail.com` | T1 | parent | dev |
| `h@g.com` | T1 | parent | dev |

**Audit fixtures** (deterministic, dev-only password `AuditFixtures2026!`, used by tenant-isolation scripts):

| Email | Tenant | Role |
|---|---|---|
| `audit.parent.t1@ballpark.test` | T1 | parent (1 kid auto-created) |
| `audit.coach.t1@ballpark.test`  | T1 | coach |
| `audit.parent.t2@ballpark.test` | T2 | parent (1 kid auto-created) |
| `audit.coach.t2@ballpark.test`  | T2 | coach |

If the fixtures don't exist yet in this environment:

```bash
node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'
node scripts/seed-audit-rows.mjs
```

### Required starting state

A clean smoke run needs (per tenant): at least one coach, at least one family with one kid, and ideally one seeded booking. Confirm with:

```sql
-- Replace :tenant with '00000000-0000-0000-0000-000000000001' for T1
SELECT count(*) AS coaches   FROM public.coaches  WHERE tenant_id = :tenant;
SELECT count(*) AS families  FROM public.families WHERE tenant_id = :tenant;
SELECT count(*) AS kids
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
 WHERE f.tenant_id = :tenant;
SELECT count(*) AS session_types FROM public.session_types WHERE tenant_id = :tenant;
SELECT count(*) AS locations     FROM public.locations     WHERE tenant_id = :tenant;
```

Expect ≥ 1 row each. If `session_types` or `locations` is 0 in T2, the v0.3 booking flow will be empty there — re-apply `supabase/migrations/20260508000000_v06_test_tenant_two.sql` and `20260508000100_v06_test_tenant_two_fix_session_type_id.sql`.

### Environment

Real testing happens **on a physical phone via Expo Go**. The Replit preview pane is NOT a mobile testing surface — Metro is a packager, not a web app, and a bare `GET /` from a browser gives `CommandError: Must specify "expo-platform" header…` (surfaced as 502 in the canvas iframe).

```bash
# 1. Boot Metro with a public tunnel
npm run dev          # = expo start --tunnel

# 2. Scan the QR code in the workflow console with Expo Go (iOS or Android).
```

Required env vars on the dev machine (`.env` at repo root):

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...        # publishable (anon) key
EXPO_PUBLIC_TENANT_SLUG=infinitehitting  # or test-tenant-two
SUPABASE_SERVICE_ROLE_KEY=...            # server-side only; used by scripts/, never bundled
# EXPO_PUBLIC_AUTH_REDIRECT_HOST=app.ballpark.com  # optional; enables https deep links
```

### TestFlight differences

When smoking a TestFlight build (vs Expo Go) the same per-version flows apply, **but**:

- Push tokens are real APNs, not Expo push tokens. The `device_tokens` row will have a different shape (see push section).
- The deep-link host is whatever `EXPO_PUBLIC_AUTH_REDIRECT_HOST` was set to at EAS build time. If unset, signup confirmation links use the `ballpark://` custom scheme and only work from Mail/SMS, not Safari.
- No Metro hot reload — every code change requires a new EAS build.
- Edge Function deploys (`mux-create-upload`, `mux-webhook`, `send-push`, `send-coach-video-notification`) are environment-wide; a TestFlight smoke is hitting the same Supabase project as dev unless you've published to a separate project.

---

## v0.1 — Auth + kid registration

**Preconditions:** Clean install (sign out + delete app from device, then re-scan QR). T1 selected. No existing account at the email you're about to use.

**Steps in Expo Go:**

1. Open app → land on `SignInScreen`.
2. Tap "Create account" → fill SignUp form (email, password, first/last name, phone) → submit.
3. Email confirmation arrives. Tap the confirm link on the device — the deep link should open the app and exchange the `?code=…` PKCE token for a session.
4. After confirm, app routes to `AddKidScreen`. Add Jake (first name, age group, position).
5. App lands on the Home tab.
6. Force-quit and reopen the app → still signed in (session persisted via `expo-secure-store`).
7. Go to Me tab → Sign out → returned to SignIn.
8. Sign back in with the same credentials → Home loads.

**Verify in DB:**

```sql
-- Auth user exists and is confirmed
SELECT id, email, email_confirmed_at, raw_user_meta_data->>'app_role' AS app_role
  FROM auth.users
 WHERE email = '<your_email>';
-- app_role should be NULL (parent default; coaches get 'coach')

-- handle_new_user trigger inserted a family row pinned to T1
SELECT id, tenant_id, parent_user_id, parent_email
  FROM public.families
 WHERE parent_email = '<your_email>';

-- Kid exists under that family
SELECT k.id, k.first_name, k.age_group, k.primary_position, k.points_balance
  FROM public.kids k
  JOIN public.families f ON f.id = k.family_id
 WHERE f.parent_email = '<your_email>';
```

**Pass:** 1 row in each query. `families.tenant_id` matches T1.

> Coach signup is NOT in the app. Coaches are admin-created via `scripts/provision-coach-mike.mjs <password>`; the `handle_new_user` trigger branches on `raw_user_meta_data.app_role = 'coach'` and writes to `public.coaches` instead of `public.families`.

---

## v0.2 — Home tab

**Preconditions:** v0.1 passed. Signed in as a parent with one kid.

**Steps in Expo Go:**

1. Tap Home tab.
2. Confirm the welcome header (kid's first name) and all Home sections render in order:
   - Points hero card with progress bar to next reward
   - 3-tile stats row (streak, rank, exit velo)
   - "New from Coach" video preview card (or empty state)
   - "Up Next" booking card (or empty state)
   - "Assignments due" list (or empty state)
   - "Latest PR" hero card (or empty state)
3. Pull down to refresh — spinner appears, data refetches.
4. Tap each card and confirm it navigates (Earn / Book / Detail screens).
5. Open Metro logs in the workflow console — no red `[ERROR]` lines.

**Verify in DB:** Home is read-only — no writes to confirm. Instead, sanity-check that the underlying rows match what each card displays:

```sql
-- Points hero card source
SELECT id, first_name, points_balance, current_streak_days
  FROM public.kids
 WHERE id = '<your_kid_id>';

-- "Up Next" card source — earliest non-cancelled future booking
SELECT id, scheduled_start, scheduled_end, status, coach_id, session_type_id
  FROM public.bookings
 WHERE kid_id = '<your_kid_id>'
   AND status IN ('pending', 'confirmed')
   AND scheduled_start >= now()
 ORDER BY scheduled_start ASC
 LIMIT 1;

-- "New from Coach" card source — newest unviewed coach message for this family
SELECT cm.id, cm.created_at, cm.viewed_at, v.status AS video_status, v.purpose
  FROM public.coach_messages cm
  JOIN public.videos v ON v.id = cm.video_id
 WHERE cm.recipient_family_id = '<your_family_id>'
 ORDER BY cm.created_at DESC
 LIMIT 1;

-- "Assignments due" list source — pending drills for this kid
SELECT id, title, due_date, point_reward, status
  FROM public.assignments
 WHERE kid_id = '<your_kid_id>' AND status = 'pending'
 ORDER BY COALESCE(due_date, '9999-12-31') ASC;
```

**Pass:** All Home sections render, no console errors, pull-to-refresh works, and each verification query returns rows that visually match the corresponding card (or an empty result that matches the card's empty state).

---

## v0.3 — Booking

**Preconditions:** v0.1 passed. T1 selected. At least one `coach_availability` row exists for the current week (seeded by `supabase/migrations/20260505060000_v03_bookings_seed.sql`).

**Steps in Expo Go:**

1. Tap Book tab.
2. Filter pills: tap "Private", "Group", "Cage Rental", "All" — slot list filters.
3. Pick a future slot → confirm screen appears with coach + time + session type.
4. Tap Confirm → success toast → returned to Book tab.
5. Booking shows under "Your Upcoming".
6. Open Home tab → "Up Next" card now shows the new booking.

**Verify in DB:**

```sql
SELECT id, tenant_id, kid_id, coach_id, session_type_id,
       scheduled_start, scheduled_end, status, location_id
  FROM public.bookings
 WHERE kid_id = '<your_kid_id>'
 ORDER BY created_at DESC
 LIMIT 5;
-- newest row: status = 'pending' or 'confirmed', tenant_id = T1,
-- scheduled_start matches the slot you picked.
```

Supporting tables (no writes from this flow): `public.session_types`, `public.coach_availability`, `public.locations`.

**Pass:** New `bookings` row exists with correct tenant/kid/coach/time. Home "Up Next" updated.

---

## v0.4 — Coach video messaging

**Preconditions:** v0.1 + a coach account on T1. Sign in as coach (`coach.mike@infinitehitting.com`) on one device, parent on another (or use two simulators).

**Steps in Expo Go (coach):**

1. Sign in as coach → coach Home renders.
2. Tap "Record Video" → record or pick a clip → choose recipient family → tap Send.
3. Mux upload progress shown; on complete, message lands in "Sent Videos".

**Steps in Expo Go (parent):**

1. Within ~60s of coach send, Home → "New from Coach" card appears.
2. Tap card → full-screen player → video plays.
3. Close player → card now shows "viewed" indicator.
4. Resend email arrives at the parent's address.

**Verify in DB:**

```sql
-- Video record from coach upload, tagged with purpose='coach_message'
SELECT id, tenant_id, mux_asset_id, mux_playback_id, status,
       purpose, duration_seconds, uploaded_by_user_id
  FROM public.videos
 WHERE uploaded_by_user_id = '<coach_user_id>'
 ORDER BY created_at DESC
 LIMIT 1;
-- status should be 'ready' (or 'processing' briefly), purpose = 'coach_message'

-- Coach message links the video to a recipient family
SELECT id, tenant_id, video_id, sender_user_id, recipient_family_id,
       recipient_kid_id, viewed_at, created_at
  FROM public.coach_messages
 WHERE recipient_family_id = '<parent_family_id>'
 ORDER BY created_at DESC
 LIMIT 1;
-- viewed_at: NULL before parent opens, timestamp after parent opens
```

The parent's "mark as viewed" call goes through the `mark_coach_message_viewed` SECURITY DEFINER RPC (migration `20260505100000`) — direct UPDATE is not granted to parents.

**Pass:** Video row at `status='ready'` with `purpose='coach_message'`; `coach_messages` row exists; `viewed_at` populates after full-screen playback; Resend email received.

---

## v0.5 — Points + rewards

**Preconditions:** v0.1 + v0.3 passed. Parent has a kid with at least one booking.

**Steps in Expo Go:**

1. Coach (or service-role admin) marks one of the kid's bookings `completed`:
   ```sql
   UPDATE public.bookings SET status = 'completed' WHERE id = '<booking_id>';
   ```
   This fires the `award_booking_completion_points` trigger → +10 pts.
2. Parent opens Earn tab → Points balance increased by 10. Recent Earnings shows the +10 entry.
3. Earn → Rewards tab → pick a reward the kid can afford → tap Redeem → confirm.
4. App shows an 8-character redemption code.
5. Me tab → Orders → the redemption appears with the same code.

**Verify in DB:**

```sql
-- Ledger entry from the booking-completion trigger
SELECT id, kid_id, delta, reason, reference_type, reference_id, balance_after, created_at
  FROM public.points_ledger
 WHERE kid_id = '<kid_id>'
 ORDER BY created_at DESC
 LIMIT 5;
-- newest row: delta = +10, reason = 'booking_completed' (or similar), reference_id = booking_id

-- Kid balance reflects ledger sum
SELECT id, first_name, points_balance FROM public.kids WHERE id = '<kid_id>';

-- Redemption row + 8-char code
SELECT id, tenant_id, family_id, kid_id, product_id, payment_method,
       amount_paid_points, status, redemption_code, created_at
  FROM public.orders
 WHERE kid_id = '<kid_id>'
 ORDER BY created_at DESC
 LIMIT 1;
-- payment_method = 'points', status = 'ordered', redemption_code is 8 chars [A-Z0-9]

-- Product catalog (no writes; sanity check)
SELECT id, name, points_cost, is_redeemable, is_active
  FROM public.products
 WHERE tenant_id = '<T1>' AND is_active;
```

**Pass:** +10 ledger entry exists with correct `reference_id`; `kids.points_balance` matches ledger sum; `orders` row created with a unique `redemption_code`; same code visible in Me → Orders.

---

## v0.6 — Drill assignments

**Preconditions:** v0.1 passed; coach + parent accounts on T1.

**Steps in Expo Go (coach):**

1. Sign in as coach → tap "Assign Drill".
2. Fill: title, optional notes, optional Mux drill video upload, duration (min), due date, point reward (default 25). Submit.
3. Coach sees assignment in their queue.

**Steps in Expo Go (parent):**

1. Home tab → "Assignments due" list shows the new drill.
2. Work tab → drill listed with title + due date + point value.
3. Tap drill → detail screen → tap "Mark as done" → success toast. Points balance jumps by `point_reward`.

**Steps in Expo Go (coach review):**

1. Coach Home → "Reviews to do" queue → tap the submitted drill.
2. Pick 1–5 stars + write feedback → Submit. Drill drops out of the queue.

**Verify in DB:**

```sql
-- Assignment row through the lifecycle
SELECT id, tenant_id, kid_id, family_id, coach_user_id,
       title, drill_video_id, duration_estimate_minutes, due_date,
       point_reward, status, submitted_at, reviewed_at, rating, feedback
  FROM public.assignments
 WHERE kid_id = '<kid_id>'
 ORDER BY created_at DESC
 LIMIT 1;
-- status flow: 'pending' -> 'submitted' (after parent taps done)
--           -> 'reviewed' (after coach saves rating + feedback).
-- 'reviewed' row must have rating IN (1..5), reviewed_at NOT NULL.

-- Points awarded on parent "Mark as done"
SELECT id, kid_id, delta, reason, reference_type, reference_id, balance_after, created_at
  FROM public.points_ledger
 WHERE reference_type = 'assignment'
   AND reference_id = '<assignment_id>';
-- exactly 1 row; delta = assignments.point_reward (default 25)

-- Optional drill video tag
SELECT id, purpose, status FROM public.videos
 WHERE id = (SELECT drill_video_id FROM public.assignments WHERE id = '<assignment_id>');
-- purpose = 'drill', status = 'ready'
```

`complete_assignment_for_kid` is a SECURITY DEFINER RPC — direct UPDATE on `assignments` from the parent is not granted; it goes through the function which atomically flips status, stamps `submitted_at`, and writes the ledger row.

**Pass:** Assignment lifecycle (`pending` → `submitted` → `reviewed`) with matching ledger entry; coach can save rating + feedback; drill video (if uploaded) tagged `purpose='drill'`.

---

## Push notifications

> Task #93 (push + email notifications via `device_tokens`, `send-push`, `send-coach-video-notification`, mux-webhook trigger) is **in flight**. This section will need a tweak after that ships — verify column names against the migration before relying on the SQL below.

**Preconditions:** TestFlight build (or Expo Go with notification permission granted). Parent signed in.

**Steps in Expo Go:**

1. Cold launch app as parent → on first run, OS prompts for notification permission → allow.
2. App registers a device token at launch (Expo push token in dev, APNs in TestFlight).
3. Coach uploads a video to this parent's family (see v0.4).
4. Within ~10s of `mux-webhook` flipping `videos.status='ready'`, parent's device receives a push notification with the coach's name + "sent you a video".
5. Tap notification → app opens to Home → "New from Coach" card focused.

**Verify in DB:**

```sql
-- Device token row for the signed-in user
SELECT id, user_id, token, platform, created_at
  FROM public.device_tokens
 WHERE user_id = '<parent_user_id>'
 ORDER BY created_at DESC
 LIMIT 5;
-- newest row: token populated, platform IN ('ios', 'android'),
-- one row per (user, device).
```

Edge Functions involved:

- `send-push` — generic push fan-out (takes user_id list + payload).
- `send-coach-video-notification` — domain wrapper that resolves recipient family, looks up parent device tokens, calls `send-push`.
- `mux-webhook` — on `video.asset.ready`, looks up the matching `coach_messages` row and invokes `send-coach-video-notification`.

**Pass:** Push delivered to phone; tapping it deep-links to Home; `device_tokens` row present and current.

---

## Tenant isolation

The full audit lives in [`docs/TENANT_ISOLATION_AUDIT.md`](../TENANT_ISOLATION_AUDIT.md) (14 tables × 4 users × 3 probe classes + kids-INSERT spec probe = 170 probes). This section gives you the smoke-level repro.

### How T2 was provisioned

```bash
# Migration that inserted Test Tenant Two + a location + session_types.
# Re-running is a no-op because IDs are deterministic:
#   tenant id   = 00000000-0000-0000-0000-000000000002
#   tenant slug = test-tenant-two
psql "$DATABASE_URL" -f supabase/migrations/20260508000000_v06_test_tenant_two.sql
psql "$DATABASE_URL" -f supabase/migrations/20260508000100_v06_test_tenant_two_fix_session_type_id.sql
```

### Adding a third test tenant

1. Insert a row into `public.tenants` with a fresh UUID and slug (write a new migration; do not hand-INSERT in prod).
2. Seed at least one `locations` and one `session_types` row for that tenant.
3. Provision audit fixtures using the same script pattern as T1/T2. The current `scripts/provision-audit-fixtures.mjs` only knows about T1 + T2 — extend the `fixtures` array (`scripts/provision-audit-fixtures.mjs:52`) to add T3 entries, then re-run:
   ```bash
   node scripts/provision-audit-fixtures.mjs 'AuditFixtures2026!'
   node scripts/seed-audit-rows.mjs
   ```

### Manual cross-tenant smoke (Expo Go)

1. Edit `.env`: `EXPO_PUBLIC_TENANT_SLUG=test-tenant-two`.
2. Restart Metro.
3. Sign in as `audit.parent.t2@ballpark.test` / `AuditFixtures2026!`.
4. Walk every tab. Confirm:
   - Home shows the T2 kid (AuditKid TenantTwo), not the T1 kid.
   - Book tab shows only T2 coaches and T2 session types.
   - Earn → Ranks shows only T2 kids on the leaderboard.
   - Me → Orders shows only T2 redemption history.
5. There must be **zero** rows belonging to Infinite Hitting visible anywhere in the UI.

### Programmatic API probes (curl)

These reproduce the spirit of `scripts/audit-tenant-isolation.mjs` against a single attack surface. Sign in as a T1 parent, capture the JWT, then attempt to read/write T2 rows.

```bash
# 0. Get a T1 access token
TOKEN=$(curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"audit.parent.t1@ballpark.test","password":"AuditFixtures2026!"}' \
  | jq -r .access_token)

T2_KID_ID=$(psql "$DATABASE_URL" -At -c \
  "SELECT k.id FROM public.kids k JOIN public.families f ON f.id=k.family_id WHERE f.tenant_id='00000000-0000-0000-0000-000000000002' LIMIT 1;")
T2_FAMILY_ID=$(psql "$DATABASE_URL" -At -c \
  "SELECT id FROM public.families WHERE tenant_id='00000000-0000-0000-0000-000000000002' LIMIT 1;")

H_AUTH="Authorization: Bearer $TOKEN"
H_KEY="apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
BASE="$EXPO_PUBLIC_SUPABASE_URL/rest/v1"
```

Each probe below should hit RLS, not the data:

```bash
# 1. Enumerate families — must return only T1 rows (no T2 leakage)
curl -s "$BASE/families?select=id,tenant_id" -H "$H_AUTH" -H "$H_KEY" \
  | jq '[.[] | select(.tenant_id == "00000000-0000-0000-0000-000000000002")] | length'
# expected: 0

# 2. Select a T2 kid by id — must return 0 rows
curl -s "$BASE/kids?id=eq.$T2_KID_ID&select=id" -H "$H_AUTH" -H "$H_KEY"
# expected: []

# 3. Enumerate bookings — must return only T1 rows
curl -s "$BASE/bookings?select=id,tenant_id" -H "$H_AUTH" -H "$H_KEY" \
  | jq '[.[] | select(.tenant_id == "00000000-0000-0000-0000-000000000002")] | length'
# expected: 0

# 4. Enumerate videos — must return only T1 rows
curl -s "$BASE/videos?select=id,tenant_id" -H "$H_AUTH" -H "$H_KEY" \
  | jq '[.[] | select(.tenant_id == "00000000-0000-0000-0000-000000000002")] | length'
# expected: 0

# 5. PATCH a T2 kid — must affect 0 rows (RLS denies)
curl -s -X PATCH "$BASE/kids?id=eq.$T2_KID_ID" \
  -H "$H_AUTH" -H "$H_KEY" -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d '{"jersey_number": 99}'
# expected: [] (zero rows changed)

# 6. INSERT a kid into a T2 family — must fail with 42501 RLS violation
curl -s -X POST "$BASE/kids" \
  -H "$H_AUTH" -H "$H_KEY" -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d "{\"family_id\":\"$T2_FAMILY_ID\",\"first_name\":\"Probe\",\"last_name\":\"FromT1\",\"age_group\":\"10U\"}"
# expected: {"code":"42501","message":"new row violates row-level security policy for table \"kids\"", ...}
```

### Full audit one-liner

```bash
node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'
echo "exit=$?"   # 0 = PASS (170/170 probes), non-zero = leak count
```

If exit ≠ 0 or any of the 6 curl probes above misbehaves, **stop the smoke run** and link the failure into the bug report below. See [`docs/TENANT_ISOLATION_AUDIT.md`](../TENANT_ISOLATION_AUDIT.md) for the full matrix and remediation history.

---

## Pre-pilot checklist

Tick every box within 24h of cutting a pilot build.

- [ ] **v0.1 Auth** — signup, email confirm deep link, sign in/out, kid creation all pass on a clean install.
- [ ] **v0.2 Home** — all 5 cards render, pull-to-refresh works, no console errors.
- [ ] **v0.3 Booking** — slot picker → confirm → row in `public.bookings`; appears in Up Next.
- [ ] **v0.4 Coach video** — Mux upload → in-app card → full-screen playback marks viewed → Resend email arrives.
- [ ] **v0.5 Points + rewards** — booking completion auto-credits +10; redemption issues an 8-char code visible in Me → Orders.
- [ ] **v0.6 Drill assignments** — full lifecycle (pending → submitted → reviewed) works; ledger entry matches `point_reward`.
- [ ] **Push** — `device_tokens` row present after launch; push delivered on new coach video (TestFlight only).
- [ ] **Tenant isolation** — `node scripts/audit-tenant-isolation.mjs 'AuditFixtures2026!'` exits 0 (170/170 PASS, 0 skipped).

**Database integrity:**

```sql
-- Orphan kids (kids whose family no longer exists)
SELECT count(*) AS orphan_kids
  FROM public.kids k LEFT JOIN public.families f ON f.id = k.family_id
 WHERE f.id IS NULL;
-- expected: 0

-- Bookings missing tenant_id
SELECT count(*) FROM public.bookings WHERE tenant_id IS NULL;
-- expected: 0

-- Videos stuck preparing > 1h
SELECT count(*) FROM public.videos
 WHERE status IN ('uploading', 'processing')
   AND created_at < now() - interval '1 hour';
-- expected: 0 (or investigate Mux dashboard)

-- points_ledger sum per kid must match kids.points_balance
SELECT k.id, k.points_balance,
       COALESCE(SUM(pl.delta), 0) AS ledger_sum,
       k.points_balance - COALESCE(SUM(pl.delta), 0) AS drift
  FROM public.kids k
  LEFT JOIN public.points_ledger pl ON pl.kid_id = k.id
 GROUP BY k.id, k.points_balance
HAVING k.points_balance <> COALESCE(SUM(pl.delta), 0);
-- expected: 0 rows

-- Orders without a redemption_code
SELECT count(*) FROM public.orders WHERE redemption_code IS NULL OR redemption_code = '';
-- expected: 0
```

- [ ] All 5 integrity queries return the expected 0.

**Performance smoke:**

- [ ] Mux upload → playable: a 30s clip recorded in-app reaches `videos.status='ready'` within 60s.
- [ ] Push delivery: < 10s from coach upload completion to push notification on parent device.
- [ ] Cold app launch → Home rendered: < 3s on a recent device (iPhone 13 / Pixel 6 class).

**Edge Functions deployed** (re-deploy if any are stale — editing `supabase/functions/<name>/` does NOT change what Supabase serves until you push):

```bash
npx supabase functions deploy mux-create-upload
npx supabase functions deploy mux-webhook --no-verify-jwt
npx supabase functions deploy send-push
npx supabase functions deploy send-coach-video-notification
```

`scripts/post-merge.sh` re-deploys `mux-create-upload` + `mux-webhook` automatically after every task merge; the push functions are not yet wired into post-merge (track via task #93).

- [ ] `mux-create-upload`, `mux-webhook --no-verify-jwt`, `send-push`, `send-coach-video-notification` all deployed and current.
- [ ] Resend domain verified (sender address authorised).
- [ ] `MUX_WEBHOOK_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` set on Supabase project (`npx supabase secrets list`).
- [ ] Stripe Connect account present on `tenants.stripe_account_id` for the pilot tenant (even though card checkout is deferred — needed for v0.7+).

---

## Bug reporting template

Copy/paste into a GitHub issue (or wherever bugs are tracked) and fill in:

```markdown
**Title:**

**Version:** v0.x (which milestone section was running when the bug surfaced)
**Tenant:** Infinite Hitting / Test Tenant Two / other
**Account email:**
**Device + OS:** e.g. iPhone 14 Pro, iOS 17.4
**Build:** Expo Go (SDK 54) / TestFlight build <version>

**Steps to reproduce:**
1.
2.
3.

**Expected:**

**Actual:**

**Screenshots / video:**

**Relevant DB rows:**
- table: `public.<table>`
- id: `<uuid>`
- (paste the row or a SELECT one-liner that reproduces the bad state)

**Console / Metro log snippet:**
```
<paste the red lines + a few lines of context>
```

**Severity:**
- [ ] S1 — data loss / cross-tenant leak / crash on launch
- [ ] S2 — core flow broken (signup, booking, video, redemption)
- [ ] S3 — non-core flow broken or visual regression
- [ ] S4 — polish / nice-to-have
```
