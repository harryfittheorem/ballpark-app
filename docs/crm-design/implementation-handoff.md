# Staff CRM inquiry journey — development handoff

## Safety and scope

This is the native Next.js portal, not the mockup sandbox. The approved
development path uses synthetic parents, a non-delivering SMS/call double,
controlled model responses and isolated PostgreSQL. No shared Supabase
migration, member mutation, real family message, purchased number, connected
live account or production deployment was performed.

The normal application routes use cookie-bound Supabase authentication and
database authorization. The rehearsal still requires an **existing** owner or
admin session; it does not introduce a GM role or bypass sign-in. It creates
only an explicit grant for that existing identity in the isolated fixture.
The other fixture location stays inaccessible to that identity.

## Preview and reproduction

1. Start the managed **CRM isolated rehearsal** workflow. It initializes and
   keeps the isolated fixture database available.
2. Start the existing **Portal dev** workflow on **5000**.
3. Sign into the staff portal with an existing authorized owner/admin.
4. Open `/owner/crm?preview=1` or `/admin/crm?preview=1`.
5. The rehearsal workflow handles repeating internal due checks and
   queued-action recovery. Its
   command is `python scripts/crm-preview.py && python scripts/crm-worker.py`.
   A detached one-off PostgreSQL start can be reaped between requests in this
   environment. Do not start another worker alongside the managed one. It
   never opens a provider connection.
6. To replay from scratch, stop that workflow, run
   `python scripts/crm-preview.py reset`, then restart the workflow. Reset **archives**
   the old isolated cluster under ignored `generated-artifacts/` and creates
   another. It never resets Supabase. `stop` stops only the fixture server.

### Avery → Eli → Thursday after 5

- Overview → Avery Morgan opens the same Inbox thread used by Pipeline.
- Context → **Prepare assistance** inspects actual fixture openings and writes
  an editable draft. Default draft authority cannot reserve or send.
- **Offer times** prepares eligible coach/cage openings in facility time.
  Use **Save draft**, or explicitly **Queue SMS**, then **Dispatch due step**.
  Provider acceptance is labeled simulated and is **not delivery**.
- In rehearsal, select an offered opening to record a controlled parent
  choice. **Book this evaluation** explicitly reserves it. A canonical
  `bookings` row, not a pipeline-stage change, determines success.
- Refresh and open a phone viewport. The booking, private note, SMS draft,
  booking event, stopped-nurture reason and reminder intent remain persisted.
- To exercise delegated operation, save/enable a **delegated** workflow version
  in this isolated preview. After the controlled parent selection, **Prepare
  assistance** can reserve and prepare/dispatch one confirmation. Delegation
  cannot be enabled outside a simulated binding.

### Takeover and unanswered callback

- Jordan → Context → Rehearsal inbound → “Could a coach call me?”
- The signed synthetic inbound handler creates one unassigned callback and a
  durable human hold. **Take over** assigns staff ownership; **Set** assigns
  that same callback with a reason and due time, rather than duplicating it.
- **Call** logs a simulated call from the facility number. **No answer** →
  **Save call outcome** retains the due callback. No missed-call SMS is
  generated. A later inbound reply does not clear the hold.
- Staff can manually queue a permitted SMS while owning a human-held thread;
  STOP still blocks both staff and assistant outreach.

### Phone-booked / online-booked cancellation

Staff reservation and confirmed canonical evaluations from other entry paths
reach the same booking observer. It stops queued sales nurture and records the
native booking ID. The SQL/application tests also insert an already-committed
canonical online evaluation for a linked athlete to exercise the observer
without substituting a CRM stage update for booking evidence.

For a clean phone-booking replay, use a fresh fixture/Jordan before the
unanswered-call scenario: **Call** → **Completed** → **Save call outcome**,
then find/offer an opening, record the controlled parent selection and book.
The pending sales journey must become stopped without restarting because of
the call. Do not increase the contact cap to repeat calls. The captured
walkthrough also uses Casey/Lee, an explicitly preverified synthetic prospect,
to keep the original parents and their attempt history unchanged.

Rescheduling changes the separate reminder intent, not the sales journey.
Reminder intents require staff review; this slice does not silently enable
new automatic parent reminder content.
Canonical cancellation updates the visible booking status and cancels its
reminder intent; sales nurture remains stopped for staff review.

## Integration contract

- **Identity:** canonical families/kids are linked only by explicit staff
  verification of both IDs, tenant and location. New inbound endpoints start
  unresolved and without consent. No matching by name, automatic merging,
  duplicate membership creation or parent-app signup.
- **Authorization:** `crm_can_access` requires trusted tenant/app-role claims,
  authenticated user, owner/admin role and explicit `staff_locations` grant.
  All CRM reads are scoped by RLS, and authenticated direct writes are revoked.
  Channel bindings and credential references are server-only.
- **Writes:** `crm_execute` is the one native staff/assistant/workflow action
  boundary. PostgreSQL advisory locks use the scheduler's existing tenant lock
  first, then the CRM location lock. Keys, command payloads, revisions, audit
  history, queue state and results survive process/database restarts.
- **Bookings:** `crm_evaluation_services` explicitly designates evaluation types;
  openings must match active facility coach, weekly availability/effective
  dates, duration, configured instructional cage and shared capacity.
  The adapter inserts canonical prospect bookings through the existing
  `enforce_booking_reservation` trigger and `booking_capacity_has_room`.
  It does not implement another capacity counter.
- **Entitlements:** un-enrolled prospect evaluations are a separate reviewed
  evaluation path. Active enrolled athletes must use the established entitled
  booking path; the CRM observer consumes its confirmed evaluation. Existing
  booking/member credit functions are not replaced or modified.
- **Dispatch:** recipient/channel/inquiry-purpose evidence, STOP, guardian,
  human hold, revision, approved binding policy, both timezones, cap, content
  and canonical booking are checked at the dispatch boundary. Missing provider
  preserves the draft. The example 08:00–21:00 / three-contact policy exists
  only in synthetic fixtures, not as invented approval for live locations.
- **Uncertainty:** an unknown send remains held for authoritative evidence,
  never an automatic retry. A response lost after booking commit is recovered
  by the stable intent and canonical-booking lookup. A second family selecting
  the final opening receives a conflict and current availability, not success.
- **Internal reevaluation:** upcoming canonical visit and next payment within
  ten days create/update one internal task. Missing or overdue payment dates
  do not qualify. The preview worker repeats internal checks until completion.
  No parent SMS or billing action is attached. Final live boundary-policy
  approval remains a rollout prerequisite.

## Provider boundary

`/api/crm/provider` accepts form-encoded SMS/call inbound and status callbacks.
It first resolves the **candidate account**, validates Twilio-compatible
HMAC-SHA1 against the binding's server-only credential reference and configured
canonical callback URL, then verifies both account and facility destination.
Status callbacks validate the facility's originating sender instead.

The synthetic path uses a runtime-generated local signing key in the ignored,
permission-restricted rehearsal directory; no credential appears in a browser,
fixture source, model input or log. Fixtures exercise the **same signature
validator and provider application function**, not an unsigned test-only
inbound shortcut. Callback events are durable and deduplicated; terminal
evidence is sticky and conflicting receipts remain visible.

The non-delivering dispatch double records simulated acceptance; a separate
signed status receipt is required for simulated delivery. Calls are staff
initiated; autonomous voice is not included. No real outbound Twilio REST
dispatch or staff bridge is activated in this slice.

## Donor reuse map

The normal GitHub connector did not expose credentials in this fork. Read-only
Git access through the existing repository gateway **did** work. The donor was
inspected in a separate ignored sparse clone at the exact supplied revision
`5f5d8838703caaa8cc7889b5c1eac935ad562159`. The Clubhouse remote was not changed.

| Pinned MyAgencyOS source | Native destination | Retained / replaced | Evidence |
|---|---|---|---|
| `server/lib/bot-platform/sms-utils.ts` | dispatch content validation; `runAssistant` | Reject blank/unresolved content; no guessed repair. No donor brand defaults. | blank/template rejection and model-validation cases |
| `server/lib/bot-platform/claude-engine.ts` | `portal/lib/crm/engine.ts` | Six iterations; one transient **model-request-only** retry; typed tools and durable human fallback. Anthropic/GHL replaced by controlled model + native actions. | bounded-loop, retry and delegated journey cases |
| `server/lib/bot-platform/tools/find-available-slots.ts` | `crm_snapshot`, `offer_slots` | Facility-time eligible offers and opaque refs; GHL calendar reads replaced by native coach/cage/capacity contracts. | draft inspection and final-slot race |
| `server/lib/bot-platform/tools/book-appointment.ts` | `crm_execute` booking / reconciliation | Confirm only canonical committed booking; native IDs replace GHL IDs/nurture writes. | race, commit-response-loss recovery, online observer |
| `server/lib/bot-platform/tools/escalate-to-human.ts` | callback/takeover actions | Persistent hold/reason/question/owner/due; Slack/GHL tags replaced by one assigned native task. | duplicate callback and unanswered staff call |
| `server/calling-pilot/coordination.ts` | tenant/location locks, revision and outbox | Cross-channel coordination survives restart; no GHL contact locks. | queued takeover/STOP and PostgreSQL restart |
| `server/calling-pilot/policy.ts` | `crm_provider_event` status advancement | Non-regression and sticky terminal status with retained conflicting evidence. | reordered/duplicate receipt cases |
| `server/calling-pilot/providers.ts` | native location binding/provider boundary | Explicit facility identity and rehearsal gates; no shared default sender or account. No donor live voice activation reused. | signature/account/destination/location denial |

The donor simulator, processor, calling engine and donor test suite were **not**
copied or claimed as independently executed. The supplied acceptance matrix
was reimplemented against Clubhouse actions and isolated PostgreSQL.

## Checks actually run

| Check | Result |
|---|---|
| `npm --prefix portal run test:crm` | 18 passing application-handler/PostgreSQL cases |
| `npm --prefix portal run typecheck` | Passed |
| `python scripts/test-scheduling.py` | Passed all existing scheduling groups |
| `npm run test:staff-enrollment` | 34 passed, including member/payment recovery |
| `npm --prefix portal run test:navigation` | 29 passed |
| `npm --prefix portal run test:retention` | 23 passed, including isolated PostgreSQL/RLS and reporting |
| `npm --prefix portal run lint` | Blocked by existing errors in untouched RetentionReportContent and training Reports |
| `npm --prefix portal run build` | Compiled successfully; blocked at lint by those same existing errors |
| `npm run typecheck:mobile` | 19 existing errors in 12 untouched mobile files |
| Unauthenticated `/api/crm?preview=1` | 403 |

The build blockers are `react/jsx-key` at
`portal/components/owner/RetentionReportContent.tsx:156` and
`@next/next/no-html-link-for-pages` at
`portal/components/training/Reports.tsx:17`. The command wrapper's final `tail`
exit code is not treated as a passing build.

### Authenticated responsive evidence

The existing owner session was issued and injected entirely in memory, then
revoked. No password, role, metadata or member record was changed.

- Desktop 1440×960: Avery inquiry, availability-only assistance, distinct
  persisted SMS/private note drafts, explicitly queued SMS, simulated acceptance
  **not delivery**, controlled slot choice, one committed native booking after
  reload and the same thread opened from Pipeline.
- Phone 390×844: queue → conversation → Context → conversation → queue,
  persisted booking/history, named 44px controls and no horizontal overflow
  (390px content / 390px viewport). Pipeline opens that same thread.
- Workflows: new wording/45-minute delay and version survived reload;
  pause → enable → pause persisted.
- Jordan: signed simulated parent request, durable takeover, exactly one
  callback after repeated Set, unanswered call retained with due time, manual
  staff SMS still usable while automation is held.
- The resumed attempt to make another Jordan call was **correctly denied**
  by the shared three-attempt daily cap. The first unanswered call already
  supplied the required evidence; the cap was not weakened to force a repeat.
- The walkthrough identified an ignored callback-reason edit. Staff Set now
  updates the reason while preserving callback ID/due time, confirmed by the
  final application test. Due/status/last-question labels are explicit.
- Phone-booked nurture cancellation: Casey/Lee's pending journey remained
  `waiting` before a simulated staff call completed. Staff reserved the free
  Thursday 18:30 opening after controlled parent choice; one committed native
  booking stopped sales nurture. Desktop reload and phone Context showed the
  same confirmed booking and stop reason, with zero horizontal overflow.
  Repeated Call while active was refused rather than duplicating outreach.
  No cap was raised and no original parent's history was reset.
- Initial browser setup found a fixture tenant-mapping error; it was corrected
  without modifying real tenant grants. A transient dev hot-reload error did
  not recur after the final clean workflow restart.

Screenshots and result records are under ignored
`generated-artifacts/crm-evidence/`: `desktop-01-overview.png` through
`desktop-09-workflows.png`, `phone-01-thread.png` through
`phone-04-pipeline-thread.png`, `resume-*.png`, and the phone-booking scenario.
`casey-07-desktop-context-after-reload.png` and
`casey-09-phone-context-booked.png` show that final scenario's durable state.
Its `task605-casey-results.json` records a successful focused continuation with
no final-run HTTP/console/page errors. The redundant booking button identified
in that walkthrough is now hidden once a confirmed booking exists.
The first run and focused continuation retain their own result JSON, including
failed initial selectors and the expected cap denial; they are not relabeled
as entirely passing. The successful checks and first unanswered call together
establish the required outcomes.

The final 18-case application test ran after the browser-discovered fixes.
Its booking-recovery regression verifies that a linked, non-enrolled athlete's
ordinary future lesson is never adopted or confirmed as an evaluation: the
selected designated evaluation opening is reserved instead. Recovery then
reuses an actual tenant/location-matched online evaluation without creating
another reservation. Both prospect and canonical recovery queries require
explicit `crm_evaluation_services` designation.
The browser's synthetic data was exported/restored into the final schema so
the preview retains its booking/history instead of resetting the walkthrough.

## Changed implementation files

- Portal pages: `portal/app/{owner,admin}/crm/page.tsx`.
- Shared staff shell: two scoped CRM navigation links in
  `portal/components/PortalShell.tsx`; no shell redesign.
- UI: `portal/components/crm/{CRMWorkspace.tsx,crm.css}`.
- Application services: `portal/lib/crm/{types,context,http,local,provider,engine}.ts`.
- API: `portal/app/api/crm/route.ts` and `provider/route.ts`.
- Migrations: `20261121000000_crm_inquiry_journey.sql`,
  `20261121000001_crm_provider_events.sql`.
- Fixtures/runner: `scripts/crm-preview.py`, `crm-worker.py`,
  `crm_preview_import.py`, `scripts/fixtures/crm.sql`.
- Checks: `portal/tests/crm.test.cjs`, `portal/package.json`.
- Reproducible browser tooling: root `package.json`/`package-lock.json` add
  Playwright as a development dependency; downloaded browsers/evidence stay
  outside Git under ignored generated output.
- Managed isolated rehearsal workflow: `.replit`.
- This handoff and the existing project memory's approval-boundary notes.

The pre-existing generated sandbox registration change was preserved and was
not part of CRM implementation.

## Remaining staff-only Twilio rehearsal steps

1. Approve the location, independent account, owned sender, staff-only allowlist,
   staff callback identity and channel/purpose/quiet-hours/cap policy.
2. Stage migrations in an approved environment and verify the full deployed
   schema/trigger chain. This run uses the isolated transactional equivalent;
   it is not a shared-database migration compatibility certification.
3. Securely provision that account's signing/send credential reference. Set its
   canonical webhook URL and confirm TLS, number/registration readiness.
4. Enable a separately reviewed **staff-only real outbound transport/bridge**;
   the delivered development transport is deliberately non-delivering.
5. Rehearse real acceptance versus delivery/failure, invalid signatures,
   wrong-account numbers, STOP, unanswered staff callbacks and uncertain
   outcomes on allowlisted staff numbers only. Never blind-retry unknowns.
6. Keep family outreach, production activation, autonomous voice, imports,
   broader campaigns and email behind their separate approval gates.

## Workspace synchronization limitation

Initial revision was `904ecdca`, with an unrelated generated registration edit.
Fetching the shared workspace's `main` failed SSH authorization, so no force
reset, branch replacement or overwrite was attempted. Fetching GitHub worked;
its older `main` was already an ancestor. The checked-out history already
contained the merged navigation and atomic scheduling work. The later staff
phone task was reported implemented during this run; its files were not
edited in parallel. Reconcile its merge before wider rehearsal.
