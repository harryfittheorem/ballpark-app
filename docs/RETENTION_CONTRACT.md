# R03 retention evidence and approval contract

## Approval status

**No D07/D08/D11 policy approval was supplied with the excerpt. No policy is
seeded, enabled, or silently assumed.** The reporting engine supports the
candidate contract below only after an accountable approver records a version,
approval reference and prospective effective date. Other decisions must extend
the engine and its tests explicitly. Unapproved or incompatible rules, missing
history, unknown attribution and query failures show **Unavailable**, never demo
values, inferred history, annualized monthly churn, or automatic 100%.

Still requiring decisions:

- Player versus membership unit, opening boundary, eligible payment-overdue
  states, pause inclusion, expiry/nonrenewal, closing-state reactivation,
  same-tenant/cross-tenant transfer and opening-location attribution.
- Tenure after day 360; elapsed-day versus calendar boundaries for later bands.
- Birthday/season cutoffs, school/manual override authority and effective dates.
- Network privacy, any small-cell suppression threshold, named-loss access,
  correction and deletion/retention requirements.
- Network benchmark comparability and the finance LTV and actual-instructor
  attribution contracts (owned by R02/R06, not implemented independently here).

## Supported candidate contract (not approval)

`portal/lib/retention/types.ts` defines the versioned machine-readable contract.
All fields must match a supported value; the service-only policy table requires
`approvalReference`, `version` and `effectiveFrom`. Its rows cannot be edited or
deleted. `effectiveFrom` must not precede the policy record's creation time.
There is no owner-facing policy editor or client write permission. An authorized
operator inserts the approved JSON only after approval, using the normal reviewed
database-change process. Never copy a test fixture as approval.

- **Unit:** unique `(tenant, player)` at each local month opening, not contracts,
  invoices, families, signup cohorts, or MTD cancellations. Multiple contracts
  never duplicate a player in the same monthly cohort.
- **Opening:** state immediately before local midnight on day 1. New signups at
  or after the boundary are not in that month's opening cohort. This assigns
  an exit exactly at midnight to the month beginning then, once only.
- **Eligible:** active/payment-overdue contracts, plus paused contracts only
  under an explicitly approved `pauses: retained` policy. Pending enrollments
  are excluded. The alternative `excluded` candidate never treats a pause as a
  cancellation: where it produces an exit without a terminal effective date,
  that month's rate is unavailable.
- **Loss:** an opening player with no eligible contract immediately before the
  next month begins. Cancellation uses the explicitly approved
  `cancel_effective_at`, then terminal `cancelled_at`; expiry uses `expires_at`.
  A request/processing timestamp is not substituted. An active scheduled
  cancellation/expiry can take effect even if its operational cron is late.
- **Reactivation:** eligible at closing means retained. A player who cancels and
  returns before closing is not a loss under this candidate. Replacement
  contracts are considered across the player's tenant.
- **Transfers:** use the recorded primary location at opening for the entire
  month, regardless of later transfers within that tenant. Missing attribution
  fails closed, not a sole-location guess. Cross-tenant identity continuity is
  not invented. Owners cannot fetch a hidden network benchmark.
- **Timezone:** each location's reporting timezone is frozen at evidence
  installation/creation, independent of server timezone and DST. Changing
  operational timezone settings does not reinterpret past reports. A change to
  reporting timezone requires a reviewed versioned data/policy migration.
- **Range:** month/3-month/12-month/custom completed calendar months. Summaries
  sum losses and opening player-month opportunities, then divide. A player may
  be an opportunity in multiple months. Network/tenant benchmarks use the same
  segment filters and weighted denominator, never averages of percentages.
  Incompatible tenant contracts make a combined network rate unavailable.
  The latest effective governing version is selected before checking supported
  semantics; an unsupported successor never falls back to older rules.
- **Zero denominator:** opening/loss count may be 0 if evidence is complete, but
  churn/retention rates are unavailable. If any selected month lacks evidence,
  summary/detail totals are withheld; individually valid monthly rows remain.
- **Segments:** recorded division/sport/gender/Rec–Travel–Both classification
  immediately before opening. No DOB calculation or historical reconstruction.
  The established `HS` source label displays as `High School`; that is a label
  mapping, not a new classification rule. Unknown values remain explicit.
- **Tenure:** elapsed full days in the observed continuous eligible spell at
  opening. Overlapping contracts preserve continuity; an observed gap resets
  it. Baseline/backdated starts cannot establish prior continuity and stay
  unknown, including a claimed start after coverage but before its first
  observation. An observed gap and reactivation can establish a new spell.
  Bands 0–30, 31–90, 91–180, 181–270, 271–360 are non-overlapping.
  Later tenure is labeled **After 360 days — policy pending**, not split into
  invented later intervals; the later-tenure bucket's rate stays unavailable.
- **Privacy candidate:** owners see authorized names and effective loss dates;
  HQ receives aggregate server-rendered results, never raw player history in
  client props. No network rate is released without approved privacy policy.
  No small-cell threshold is silently selected.

## Evidence and reproducibility

Migration `20261120160000_retention_evidence.sql` installs:

- Tenant coverage start and frozen reporting-location metadata.
- Append-only membership state observations with source, observer, observation
  time and original start/effective cancellation/expiry dates.
- Append-only segment/location observations with provenance. The baseline is
  explicitly a **current classification**, not past segment membership.
- Triggers for inserts/changes/deletes on memberships and classification/home
  location changes. Non-reporting updates do not create history noise.

The baseline and triggers are installed in one transaction with write locks, so
there is no capture gap. Existing starts/cancellations do **not** justify
backdating coverage. Reports before coverage remain unavailable.

History uses observation time as its effective classification/state validity
boundary. Both recorded and effective timestamps must be within the report
boundary. A later birthday, manual age-group edit, scheduled cancellation edit,
or backdated current-row correction cannot rewrite a closed month. Immutable
observation IDs support loss provenance. Current names are identity labels only,
not report inputs. Source rows may be deleted without cascading report evidence.
Privacy erasure/corrections require an explicitly reviewed migration and policy;
ordinary clients cannot erase evidence.

Sport, gender and competition have no established source columns in the current
schema. Their prospective capture reads those explicit fields only when present;
they remain unknown today. No values are inferred from names, programs or DOB.
This task does not redesign member profiles.

## Access and verification

Owner routes use verified owner context plus explicitly tenant-pinned cookie
queries. History RLS permits only the owner tenant or a verified `super_admins`
row. The network loader independently verifies Auth user and database authority.
The legacy owner franchisor route redirects ordinary owners back to their own
churn report; a visual role switch cannot elevate access.

No migration is applied to a shared or published database by this fork. The
existing post-merge migration process installs it after merge. Before evidence
exists, the pages explicitly state it could not be loaded.

Run `npm --prefix portal run test:retention` for pure engine, query-boundary,
rendered-surface and isolated PostgreSQL trigger/RLS tests. The SQL suite runs
the actual migration against local fixture tables and never uses project
credentials or the shared database. It is not certification against the
deployed schema. Portal TypeScript and existing navigation tests are separate.
