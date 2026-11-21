# One-location staff CRM pilot — implementation and verification

## Approved boundary

Approved location: **Frisco Academy**. The creator named an existing account as
the pilot operator. A read-only check confirmed that account exists but found
**no explicit Frisco grant**. No role or grant was created. No real sender, receiving staff number or separate
callback handset was provided.

**Real-provider verification remains pending.** No number purchase, live routing
change, family outreach, email integration, payment processing or production
publication is authorized by this delivery.

The implementation is based on main revision `08c13382`, including the merged
native CRM foundation, actual-coach scheduling, staff enrollment and scheduler
integrity/capacity work. The pending mobile coaching “staff phone” work is not a
Twilio telephony implementation. No separate existing telephony adapter was
found in current main.

## Implemented

- Existing native Overview, Inbox, Pipeline, Workflows and prospect-evaluation
  booking remain the starting point. No replacement inbox or scheduler.
- Location-scoped, owner-configured pilot operator, explicitly approved
  identities, staff callback handset and approval evidence. Configuration saves
  **paused**. It grants no real role or location access.
- Ready/blocked/disconnected/paused controls, runtime credential/worker gates,
  pause, disconnect and restore-while-paused. History, notes, drafts, STOP and
  human holds are not deleted by these operations.
- Only the designated operator can review new outbound pilot messages or
  initiate calls. The worker checks durable evidence of that operator's review,
  current canonical role and explicit location grant.
- Both sender and destination must be approved test identities. A staff bridge
  additionally needs a distinct approved staff handset.
- Signed, account/location-bound inbound SMS and call evidence, durable replay
  rejection and dispatch-bound status callbacks. Late signed inbound STOP can
  still be recorded while the pilot is disconnected.
- REST SMS transport and staff-first voice bridge. No model-generated voice,
  autonomous calling, sender fallback or shared-account fallback.
- Separate staff and recipient call legs, with parent-bridge identity checks.
  A completed staff bridge is never presented as a confirmed guardian answer.
  No-answer/busy/failure produces one due callback; explicit staff disposition
  is separate from provider call progress.
- Durable prepared → attempting → finished/blocked attempts. The network
  request happens only after `attempting` commits. Interrupted attempts remain
  uncertain and are never automatically resent after restart.
- Explicit provider acceptance, delivery, failure and uncertainty evidence.
  Failed/uncertain SMS retains the reviewed wording.
- Preview mode never falls through to real transport, even after a private
  connection configuration mistake.
- Dispatch-time checks repeat guardian verification, inquiry permission,
  suppression, thread revision, canonical booking, both local contact windows,
  contact cap, current operator authority and current connection/approval.
- An automatic 30-second staging worker consumes reviewed work without a
  “Dispatch due step” click. Heartbeat is visible; stale heartbeat blocks ready
  status. A protected provider-staging mode is available but not activated.

Canonical prospect bookings still reserve the native scheduler's coach,
resource and capacity. Ordinary member booking and credit rules are unchanged.
Manual/online evaluation booking observers still stop sales nurture, preserve
separate reminder intent and retain the existing internal reevaluation rule.
The default remains one parent/one athlete, with explicit resolution when
identity is ambiguous.

## Verification labels

### Simulated

The private PostgreSQL rehearsal and provider doubles use synthetic identities.
They do **not** establish that any real family was contacted, any real SMS was
delivered or any real guardian answered a call.

Verified cases include:

- Valid admin role and explicit grant; owner-only configuration; designated
  operator activation; rejection of other roles, locations and reviewers.
- Both-endpoint allowlisting, signed duplicate inbound, delivery evidence,
  duplicate/out-of-order receipts and receipt/transport completion concurrency.
- Pause between prepare/begin; recoverable unstarted work; no second begin;
  unknown attempts held without automatic retry.
- STOP, later inbound, disconnect/restore, human takeover and PostgreSQL restart.
- Staff-bridge completion versus recipient no-answer; one due callback;
  explicit staff outcome; cross-destination receipt denial.
- Canonical role revocation at worker execution, channel consent, existing
  contact cap, failed/unknown draft preservation and non-delivering consumption.
- Transport-double verification of endpoint, sender, staff-first bridge,
  separate signed callback URLs, enablement and interrupted-request handling.

### Staging verified

- Original CRM application/PostgreSQL suite: **18 tests passed**.
- New pilot suite: **11 tests passed**.
- Preview/current-role/location-boundary suite: **3 tests passed**.
- Existing scheduler regression groups: **passed**.
- Staff enrollment regressions: **34 passed**, using existing test doubles;
  no live payment processing was performed.
- Portal navigation: **29 passed**.
- Retention regressions: **23 passed**.
- Production-mode portal build: **passed**, including TypeScript and lint.
- Python rehearsal/worker syntax compilation: **passed**.
- Managed automatic rehearsal worker: **running**, with a recent heartbeat
  confirmed from PostgreSQL. One uncertain send remained held after worker
  startup; it was not retried. This is simulated evidence, not Frisco provider
  evidence.
- Unauthenticated CRM and pilot reads: **403**. Worker without authorization:
  **403**.

The first build exposed three existing lint blockers. Minimal changes added the
missing retention row-element key, kept the training CSV as a download through
a non-prefetched link, and replaced one explicit test `any` with its actual
shape. No related feature was redesigned.

Authenticated desktop/phone outcome and automatic-worker runtime evidence are
recorded in the final verification section below. Owner evidence is never
substituted for non-owner front-desk permission proof.

### Provider verified

**Not verified. No real SMS or call was attempted.**

Still required:

1. Explicit existing operator role and Frisco location grant; if the desired
   front-desk user is not already an authorized admin, a separate role decision.
2. Frisco-owned Twilio account and approved server-only credential reference.
   No shared token or arbitrary existing workspace account may be substituted.
3. Approved dedicated staging sender and allowlisted receiving staff number and
   distinct callback handset. If an existing number serves a live inbox, retain
   its routing; use a staging sender or obtain separate routing approval.
4. Approved staging callback URL, both local contact windows, cap, consent/
   identity evidence and operator approval. Synthetic policy is not approval.
5. Protected staging worker configuration and runtime credential enablement.
   The designated operator must explicitly start the approved staff-only run.
6. Actual inbound/reply/delivery-failure/voice-leg/booking/pause evidence from
   that approved staff-only run, with numbers and credentials redacted.

The provider rehearsal also needs an explicitly confirmed **non-production
backend target** with these migrations installed. This delivery applied them
only to the representative private PostgreSQL rehearsal, not to shared
Supabase or production. Preview is simulation-only even if its binding is
mistakenly changed. Do not enable real transport by repurposing that preview,
resetting shared development data or silently choosing another backend.

## Reproduce safely

From the workspace root:

```sh
npm --prefix portal run test:crm
python scripts/test-scheduling.py
npm run test:staff-enrollment
npm --prefix portal run test:navigation
npm --prefix portal run test:retention
npm --prefix portal run build
```

`test:crm` resets **only** the dedicated local rehearsal cluster. Do not run it
while preserving a browser walkthrough's synthetic records. Never substitute a
shared Supabase connection or apply the fixture/reset commands to another DB.
The normal preview bootstrap upgrades the existing private schema without a
reset. It imports the unchanged native scheduler migrations and canonical JWT
hook prerequisites, not a replacement scheduling/permission engine.

Managed workflow: **CRM isolated rehearsal**:

```sh
python scripts/crm-preview.py && python scripts/crm-worker.py
```

Open **`/admin/crm?preview=1`** in the port-5000 portal. The approved owner may
need the existing owner route **`/owner/crm?preview=1`** because the established
portal layouts enforce their own role boundaries. Use the normal signed-in
account; do not bypass those layouts.

The ignored local `generated-artifacts/crm-pilot/approved-scope.json` binds
`location_id` and `operator_id` to their **actual** canonical IDs. The server
requires that exact approved source location and real grant before mapping to
the synthetic fixture. The label/timezone come from the canonical location;
all parent/athlete messages, resources and bookings remain synthetic. Without
that binding, the original deterministic rehearsal is preserved.

Provider-staging worker, **only after approval and secure provisioning**:

```sh
python scripts/crm-worker.py --provider
```

It requires `CRM_WORKER_BASE_URL` (approved HTTPS staging origin),
`CRM_PILOT_LOCATION_ID`, `CRM_WORKER_SECRET` and
`CRM_PROVIDER_REHEARSAL_ENABLED=staff-only`. The server additionally needs the
location's `CRM_TWILIO_...` reference populated securely. Do not put credentials
in chat, shell arguments, source files, this document or screenshots. No
provider-staging workflow or production schedule was enabled by this work.

## Changed implementation paths

- `supabase/migrations/20261122000000_crm_staff_pilot.sql`
- `supabase/migrations/20261122000001_crm_pilot_provider_evidence.sql`
- `portal/lib/crm/{context,provider,pilot,pilotTransport}.ts`
- `portal/app/api/crm/{pilot,worker}/route.ts`
- `portal/components/crm/{CRMWorkspace,CRMPilotPanel}.tsx`
- `portal/components/crm/crm.css`
- `portal/tests/{crm-pilot,crm-context}.test.cjs`
- `portal/package.json`
- `scripts/{crm-preview,crm-worker}.py`
- `scripts/fixtures/crm-auth.sql`
- Minimal build blockers:
  `portal/components/owner/RetentionReportContent.tsx`,
  `portal/components/training/Reports.tsx`,
  `portal/lib/training/trainual.test.ts`.

Original CRM fixtures and scheduler migrations remain reusable. Production
database migrations, billing changes and rollout were not performed.

## Final walkthrough and runtime record

The initial desktop **1440×960** and phone **390×844** checks reached the normal
sign-in boundary. No approved session was then present, so the authenticated
journey was correctly marked **blocked**, not passed. CRM data was not exposed.
The three unauthenticated API denials above were confirmed in the same run.

Evidence is stored under ignored
`generated-artifacts/crm-pilot-evidence/`, including the initial desktop/phone
sign-in screenshots and authorization-boundary JSON. The same test run then
continued with the creator's approved account and location.

Read-only development checks confirmed the account exists and its metadata
identifies it as an owner, but `staff_locations` contains **zero grants for that
account and zero grants for Frisco Academy**. No test session was issued, no
role or grant was changed, and no authenticated walkthrough was claimed.
A new grant is an access decision, not a test-fixture repair.

Decision required: approve a Frisco grant for the named account through the
normal access-management process, or select another operator and explicitly
approve that operator's necessary access. A location grant is a real access
change and may affect other location-scoped staff tools; it is not limited to
the rehearsal screen.

The ignored Frisco/operator scope binding is recorded as a **restriction**:
it does not create access, and the portal must still reject the missing grant.
The named account cannot currently complete either the normal CRM path or the
approved Frisco rehearsal path. Even after that access decision, an owner-only
walkthrough would not prove non-owner front-desk access.
