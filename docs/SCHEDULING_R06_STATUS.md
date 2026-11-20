# Scheduling and actual-instructor work

## Status

The approved scheduling/check-in scope is implemented and verified. Scheduling
migrations were applied to `ballpark-app` after the user explicitly confirmed
it is development-only and has no live customers. Acceptance used a separately
labeled synthetic tenant and accounts, not existing business memberships.
No application/edge-function production deployment, purchases or refunds were
run. Paid camp sales remain deliberately disabled.

## Implemented foundation

- Schedule uses existing database athlete IDs, authorized locations and active
  session types. Fake bookings, demo fallback and local-only success are gone.
- Staff creation uses one transaction for booking, credit deduction and a
  caller-scoped retry receipt. It validates duration and preserves nonstandard
  categories rather than deleting them.
- Staff can select "Walk-in starting now" for an existing athlete. The server
  sets the start and duration, reuses normal creation and credit checks, and
  retains original timestamps on retry. Attendance remains a separate action.
- Staff can preview and create a bounded weekly series (2–52 explicit dates,
  generated at device-local wall time). Every occurrence uses normal creation
  and existing credit rules in one transaction. Any failed date rolls back all
  bookings, links, receipts and deductions. Retry returns the same series.
  Each booking retains its own series occurrence link and can be assigned a
  cage or cancelled without changing the other occurrences.
- Owners and assigned location admins can create/edit/remove dated lesson or
  rental capacity windows, with reason and visible audit history. Normal
  limits and other dates remain unchanged. Overlapping overrides are rejected.
  Reservations and policy changes share the same lock and check all occupancy
  and window boundaries; reductions/removal below existing reservations fail
  without cancelling bookings. Cage exclusivity remains enforced.
- Portal/public/mobile reservations share database-side overlap checks.
  Locks cover arbitrary overlapping intervals, not just a start-hour bucket.
- Only explicitly configured location resources can be assigned. New pooled
  bookings require an approved manual capacity. No facility limits are seeded.
  The existing coach-slot capacity remains the legacy consumer contract.
- Owners can configure and retire instruction/rental/shared cages with audit
  history. Future reservations and draft camp resource references prevent an
  unsafe retirement or purpose change. New rental bookings require a cage;
  customer/public creation allocates one atomically without named coach choice.
  Historical unassigned rentals are not guessed or backfilled.
- Customer/public creation commits credits and retries atomically. Named coach
  choice was removed from public booking; mobile already auto-assigns an internal
  scheduled resource. Bring-a-Friend keeps its existing credit/points logic and
  adds transactional retry receipts. Rental friend bookings atomically receive
  two distinct eligible cages for their existing two reservations/two credits;
  unavailable resources roll back the whole pair and bonus, without a sharing
  exception. The mobile summary states the two-cage requirement.
- Member-detail Book Session reuses Schedule's scoped resource-aware form,
  prefills the database athlete/home location, retains optional notes and no
  longer requires a named coach. Rental cage selection and retries use the
  same staff contract rather than a separate legacy form.
- Cage assignment, cancellation and attendance retain the authenticated actor
  instead of using unrestricted service-client writes.
- Portal/mobile manual check-in records an eligible actual instructor separately
  from the scheduled coach. Correction history includes actor, time and reason.
  Corrections require a reason and are restricted to tenant owners and admins
  assigned to the booking's location. Portal/mobile controls use the same
  server-computed permission; instructors have no correction permission.
- The existing five-minute undo behavior, session linkage and points reversal
  are retained, including both current `weekly_visit_bonus` and historical
  `session_attended` reasons. Existing achievement bonuses are not revoked by
  a new policy. Historical actual instructors are left unknown.
- Roster reads apply location/instructor scope. Inserts, changes and removals
  trigger refetches, with reconnect/focus/foreground and periodic recovery.
- Raw client booking INSERT/UPDATE is revoked so older clients cannot skip credit
  deduction. Updated portal/mobile/public entry points use atomic RPCs; old
  mobile builds must upgrade before booking or checking in lessons. Raw
  cancellation writes are also denied; the policy RPC retains the existing
  cancellation window and audit behavior. No existing bookings are removed.
- Waitlist claims use the same atomic credit/resource/capacity contract and
  remember the claimed booking for safe retries. Failed claims remain
  unclaimed; expiration and the existing notification flow are retained.
- Location admins can reach the shared Schedule and dated-capacity controls
  through their own admin navigation, not the owner-only layout. Staff coaches
  retain scoped schedule/camp views and their existing check-in path;
  the UI does not advertise owner/admin-only booking or capacity mutations.
- Camps/clinics have draft creation/edit/archive, explicit event capacity,
  complete event-day windows, optional instruction cages and daily roster
  views. Drafts take no payments and enroll nobody. Paid sales default off,
  have no activation control, and no checkout/webhook was wired.
- A service-only fulfillment contract requires a trusted confirmed-purchase
  record and future explicit financial-policy approval before activation. It
  creates every day booking atomically, with idempotent enrollment/roster
  receipts, event and facility capacity checks, cage holds and no attendance.
  Membership credits are not substituted for the distinct purchase entitlement.
  Camp schedule/cancellation mutations remain blocked after purchase; daily
  check-in and actual-instructor corrections reuse the normal attendance path.

## Approved policies and remaining operational gates

The following limits remain intentional; they are not silent fallback policies.

1. **Facility capacity and resources:** the user approved manual per-location
   lesson/rental limits as the initial approach. Owners can configure positive
   limits from Schedule; changes are audited and reductions below existing
   future reservations are rejected. No numeric limits are seeded. New pooled
   bookings remain blocked until configured. Walk-ins were approved under the
   same capacity/resource/credit rules, without exceptions or paid-drop-in
   billing. Rental cage assignment and owner-managed inventory were approved
   and implemented; actual location inventory and numeric limits must still
   be entered by the business.
2. **Recurring bookings:** existing credits at creation and all-or-nothing
   series creation were approved and implemented. Future renewals are not
   borrowed and no new card charges are introduced. Future-week entitlement
   and series-wide cancellation remain undecided. Dated capacity override
   authority was approved for owners and assigned location admins and is
   implemented separately from series templates.
3. **Camps and clinics:** draft event/day models, gated full-event fulfillment,
   roster replay and separate daily attendance are implemented. The user
   explicitly chose to keep paid sales disabled. Cancellation, refunds,
   partial attendance, capacity failure after payment and compensation behavior
   remain undecided. There is no payment-provider handoff or live sales path.
4. **Permissions:** the user approved actual-instructor corrections by owners
   and assigned location admins, with reason and audit history. Other permission
   expansions remain unapproved. No GM role was invented.
5. **Release operations:** enter actual business location limits/inventory and
   ship updated mobile clients before use. The raw-write cutover intentionally
   prevents old builds from bypassing the shared booking/attendance contract.
   The Expo workflow's existing port conflict was not resolved by interrupting
   another process; native-device UI acceptance was not claimed.

## Verification performed

`python3 scripts/test-scheduling.py` starts disposable local PostgreSQL, applies
the new migrations against a minimal fixture, and uses the existing credit,
Bring-a-Friend and cancellation functions from migration sources. It checks:

- durable roster reads and actor/location isolation;
- simultaneous final-slot contenders and concurrent duplicate requests;
- overlapping resource reservations and credit rollback on failure;
- manual-capacity configuration permissions, audit history, preservation of
  correction settings, adjacent sessions and rejected unsafe reductions;
- walk-in server timestamps, separate attendance, scoped roster visibility,
  unauthorized calls, concurrent retries/final-slot contenders, cage conflicts
  and rollback on insufficient credits;
- required/eligible actual instructors, owner/assigned-admin corrections,
  instructor/cross-location/cross-tenant denial, required reasons and audit
  history, server-computed portal/mobile permission and idempotent guard reset;
- session attribution, idempotent check-in and undo, reversal of both attendance
  point reasons, and preservation of unrelated achievement points;
- customer creation without a supplied coach and single credit deduction;
- scoped cancellation, parent override denial and removal from the roster;
- Bring-a-Friend replay without duplicate roster rows or credit deduction.
- legacy rental entry points: staff/member-form cage reservation and duplicate
  requests; friend-pair distinct cages, exactly two credits and one bonus,
  unavailable-resource/insufficient-credit rollback and ordinary-rental races.
- recurring series isolation, scope, replay/final-slot races, separate attendance,
  and complete rollback of rows/receipts/credits on later-date capacity, resource
  or credit failure. `node scripts/test-weekly-recurrence.cjs` also exercises
  device-local weekly generation across spring/fall DST and half-hour timezones.
- dated override permissions, audit/replay, recurring-date isolation, interval
  boundaries, overlapping-window races, simultaneous final-slot attempts,
  restoration-versus-booking races, raw multi-row insertion limits, and safe
  base-limit/override reductions and removal.
- owner-managed resource permissions, audit/replay, safe retirement/purpose
  changes, required rental cages, automatic customer/public allocation and
  concurrent final-cage attempts with single credit deduction;
- camp draft replay and edit conflicts, disabled-sales/permission gates,
  synthetic confirmed-purchase full-roster replay, final-event-seat races,
  later-day resource/capacity rollback, daily attendance/undo, cage holds and
  preserved standard session-type categories;
- waitlist claim replay, rental resources, final-slot races against ordinary
  customer booking, insufficient-credit rollback, expired offers, direct-write
  denial and the unchanged cancellation window.

The minimal fixture suite is focused transaction testing, not a substitute for
full-schema integration. Development-schema checks found and corrected athlete
tenancy joins, location-specific coach availability and the Realtime publication.

### Authenticated development acceptance (2026-11-20)

- In separate owner/admin browser contexts, Schedule searched and selected an
  existing scoped athlete, saved without a named coach, and retained the booking
  after refresh. The already-open second-device Check-In board received the
  inserted row without manual reload.
- Admin check-in recorded Instructor One; the owner corrected it to Instructor
  Two with a reason. Scheduled attribution stayed unknown. Refresh preserved
  the correction. Undo restored Confirmed/Not recorded and removed the linked
  session. Direct database checks verified the correction actor/reason/history
  and unchanged membership credits.
- The first browser observation occurred about 30 seconds after saving, including
  time spent reloading the owner tab; it does not prove immediate push latency.
  A separate authenticated admin WebSocket probe subsequently received a real
  staff booking INSERT in 522 ms. Publication membership is also regression-tested.
- Authenticated API checks exercised customer/public creation without coach choice,
  expired/other-location availability exclusion, concurrent duplicate requests,
  the final rental slot, automatic cage assignment, waitlist claim replay, credit
  enforcement, other-location admin denial and raw-write protection.
- The completion follow-up covered legacy rental entry points. Real authenticated
  friend-pair requests received two distinct cages, exactly two credits and one
  bonus on replay; an unavailable pair left no half-booking or credit change.
  In the member-detail UI, athlete/home location were prefilled, Cage A conflicts
  failed without success, unchanged retry kept the request ID, and choosing free
  Cage B persisted one booking. Replaying its successful request returned the
  same ID with unchanged roster/credit counts and retained optional notes.
- Camp/clinic draft creation, refresh, edit, empty daily roster and archive passed.
  Canceling archive via a false confirmation sent no mutation; accepting it
  persisted archive/history. Sales stayed disabled and enrollment never marked
  attendance. The initial native-dialog test was ambiguous; the focused explicit
  false/true guard check passed.
- Real gamification exposed a weekly-visit undo regression not represented by the
  original fixture. The added migration and fixture regression now handle current
  and legacy attendance reasons. A fresh authenticated check-in/undo cycle on the
  real schema verified ledger/balance consistency, session removal and unchanged
  credits. Existing achievement bonuses retain their previous behavior.
- Paid camp fulfillment replay/races/later-day rollback were tested only with
  synthetic confirmations in disposable PostgreSQL. No real purchase handoff
  was enabled or represented as verified.
- Synthetic test accounts were disabled and their temporary credential file
  removed after verification. Labeled test-tenant audit/history rows were retained.

The portal TypeScript check passed. The root `npm run typecheck` still fails on
pre-existing cross-app/artifact configuration and unrelated mobile errors; it
reported no errors in the changed mobile scheduling files. The portal started;
the Expo workflow encountered an existing separate process already using its
port, which was not interrupted. The public booking page rendered, and an
unauthenticated booking POST was rejected.
