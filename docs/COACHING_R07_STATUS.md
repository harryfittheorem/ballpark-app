# Coaching and staff phone workflows

## Approved operating rules

- Reuse the existing role-based Clubhouse app. Keep consumer navigation,
  technical app identity and the existing staff enrollment financial scope.
- Staff already authorized for a roster may record manual measurements there.
  Tenant, assigned location and instructor scope apply to reads and writes.
- Private lesson notes are **author-only**. Other instructors, owners, GM and
  corporate accounts have no implicit access, including through raw APIs.
  Application service clients cannot select the private-note table either.
- A family may submit one final 1–5 rating with optional comment per ended,
  completed **Hitting Lesson** with a recorded actual instructor. Identical
  retries succeed without another rating; different outcomes are rejected.
- Phone checklist scope is **assigned training checklist lessons**, reusing
  published versions, prerequisites and manager-signoff rules. Partial checks
  are local until the user confirms completion; persisted completion cannot be
  unchecked. Opening this endpoint does not run auto-assignment rules.

## Delivered behavior

- The staff Sessions roster opens phone measurement, private-note and
  self-reported game history. Past/today roster selection retrieves records on
  later days without adding the separate upcoming-bookings expansion.
- Manual average/peak exit velocity retains units, dated entry, recorder,
  athlete, location and booking identity. Corrections append an explicit reason
  and original-record link; historical manual records cannot be updated,
  deleted or silently replaced by a service-client importer. Existing imported
  swing measurements and historical launch angles are untouched.
- Private notes retain date, explicit positive lesson number, author and
  booking identity. New actor-scoped queries prevent cross-account cache reuse.
- Family **Me → Game stats & lesson ratings** supports dated games, at-bats,
  singles/doubles/triples/home runs, generated total hits, strikeouts, walks,
  RBIs and notes. Instructor viewing labels these **self-reported**, not
  verified training. Entry validates whole-number ranges and hits plus
  strikeouts not exceeding at-bats.
- Family lesson ratings use real completed bookings rather than drill
  assignment feedback. Current audited actual-instructor attribution drives
  reports; the instructor at submission is retained in the immutable rating.
- Coach Hours removes Confirmed and opens lesson-level Sessions Done,
  No-Shows and Cancelled details with player, date/time, actual instructor,
  type and rating. Missing historical instructors remain unknown, not copied
  from scheduled assignments. Average rating and rated/eligible coverage use
  the same lesson set. Report date filtering uses each location's timezone.
- Verified original hire dates and first anniversaries are displayed when
  known. Account creation dates are never substituted. The new date field
  does not backfill historical employment dates.
- Add Coach/Hitting Instructor terminology replaces the requested labels;
  existing specialty values are preserved. The old fake invite-success action
  and fabricated coach-retention figures are no longer presented as real.
- Staff Home links assigned training checklists and retains the existing
  authorized enrollment flow. This work does not add enrollment discounts,
  deposits, delayed billing, new payment processing or billing permissions.
- An existing native-only Stripe import prevented Expo web from loading any
  screen. The web resolver now uses an explicit “native payments unavailable”
  boundary; iOS/Android still resolve the real SDK. This enables browser
  acceptance of coaching workflows, not browser payment support.
- Kid-directed instructor sends and legacy outbound staff text/video sends are
  blocked pending adult-message approval, including old-client/database and
  owner service-client writes. Read history and viewed receipts remain.
  Parent-to-coach messages remain guardian-authored. Mux outbound staff video
  notification fan-out and coach-video email delivery are gated in source.

## Explicit remaining policy/release gates

These are not implied approvals or completed capabilities:

1. Daily operational checklist definitions, ownership, resets and escalation
   are not approved or implemented. Only assigned training checklists are in scope.
2. Broader GM/corporate note readership is not approved; author-only is the
   approved access matrix.
3. Distance presentation is unchanged. Launch-angle presentation is removed
   without deleting the underlying data.
4. Adult instructor-to-guardian CRM sending requires D10 consent/action/location
   policy approval. No new adult CRM is implemented. Legacy staff outbound sends
   are intentionally unavailable rather than being relabeled as approved CRM.
5. Coach-retention attribution requires an approved model. No weights or
   fabricated retention percentages are published.
6. Checklist manager verification and prerequisite rules are preserved, not
   bypassed by phone completion. This is not a replacement training admin UI.
7. Migrations are installed on the confirmed shared **development** Supabase
   project. No production app or Edge Function deployment was performed from
   this task fork. The existing post-merge script deploys the changed Mux/email
   functions and includes their shared policy gate.

## Verification

- `python3 scripts/test-coaching.py`: disposable PostgreSQL tests authorization,
  independent connections, author-only notes, tenant/location/family isolation,
  append-only corrections and importer protection, validation, concurrent
  duplicate ratings, actual-attribution changes, report denominators and
  historical messaging receipts.
- `node scripts/coaching-acceptance.mjs seed --development-only` and
  `api <temporary-fixture>`: real authenticated development checks using
  isolated synthetic accounts, independent sessions, actual schema/triggers,
  private-note direct SELECT denial, manual provenance and service-client
  overwrite denial, games, rating races, report coverage, known hire dates and
  phone-checklist token/role authorization.
- `npm run test:staff-enrollment`: existing enrollment regression suite.
- `npm --prefix portal run test:navigation`: existing consumer/portal identity
  and navigation regression suite.
- Both regression suites passed (34 enrollment and 29 navigation tests).
- `npm --prefix portal run typecheck` passed.
- Root mobile type checking has pre-existing errors in unrelated mobile
  modules (19 errors in 12 older files, none in the new coaching screens);
  this is not represented as a passing whole-app check.
- The Metro resolver was checked to route iOS to the unchanged native Stripe
  SDK and only web to the explicit unavailable implementation.
- A phone-sized browser acceptance pass verified roster entry, manual
  measurement/private-note saves, fresh second-session persistence, distinct
  booking navigation, assigned-checklist completion/read-only persistence,
  family game validation and saving, immutable ratings, disabled instructor
  outbound messaging and retained video history. It caught and resolved a
  stale development portal origin and the missing instructor game view.
- The focused follow-up verified the instructor's separate self-reported Games
  tab, all saved game fields, and read-only lesson score/comment. Owner
  Coach Hours reconciled to **4.5 average, 2/2 rated**, including both lesson
  drilldowns, verified hire/anniversary dates and the player Sessions Done
  link to real history.
- `node scripts/coaching-acceptance.mjs inspect <temporary-fixture>` passed
  read-only reconciliation of those browser saves, authorization, final
  report totals and persisted checklist completion.
- Physical iOS/Android devices and real payment collection were not exercised
  in this task. The native enrollment implementation was reused, not rebuilt.

Synthetic test accounts must be disabled with
`node scripts/scheduling-acceptance.mjs close <temporary-fixture>` after
acceptance. Private-note/audit history is intentionally retained in the labeled
test tenant; temporary credentials are removed.
