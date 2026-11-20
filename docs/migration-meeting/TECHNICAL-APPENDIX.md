# Internal technical evidence and readiness backlog

**Inspected 12 November 2026 · repository baseline `43bfb5c` · documentation task only**

No live account, database, scheduler, export, customer or payment inspection was performed. No application or importer changes were made. File/line references describe this snapshot; verify against later code before execution.

## Evidence ledger

| ID / label | Current evidence | Meaning and limitation |
|---|---|---|
| C1 [C] | `scripts/import-mindbody-clients.mjs`: grouping at 202–229; ID derivation at 77–78; auth setup at 174–186 | Families grouped by email; deterministic IDs omit source site. Missing-email rows skipped. Invite/password setup required. File header’s “standard export” label is not verified compatibility. |
| C2 [C] | `scripts/import-mindbody-memberships.mjs`: mapping 149–165 and 188–220; writes 259–273; `scripts/mindbody-plan-map.json` | Unknown money becomes zero, unknown status cancelled, unmapped contracts skipped. Amount/start/status rows only; no saved-method migration, next-bill preservation or subscription creation. Mapping file is not approved legacy-price evidence. |
| C3 [C] | `scripts/import-mindbody-visits.mjs`: completed filter 192; first location 219–230; matching 153–170; date construction 267–281 | Completed history only; first-location attribution, fuzzy staff/service matching and noon-UTC synthesis are unsafe for accurate multi-location/future-booking migration. |
| C4 [C] | `scripts/import-mindbody-sales.mjs`: ID 68–69, money/method 141–150, first membership 214–218, paid row 225–234 | Historical paid events; quantity/date/status/refund/source-reference handling needs actual-data review. Unknown payment methods become cash; invalid date can become now. Do not treat these rows as newly collected cash. |
| C5 [C] | CSV parsers in all four importers; `resolution=ignore-duplicates` writes | Line-based quote handling cannot establish robust multiline/escaped CSV compatibility. Duplicate ignoring does not reconcile changed source data or prove accurate inserted counts. |
| C6 [C] | `scripts/validate-mindbody-import.mjs`: tenant-wide checks, membership `limit=1000` at 210 and booking `limit=2000` at 226 | Partial checks, not full paginated per-location/per-batch/per-record accounting or financial acceptance. |
| C7 [C] | `scripts/reconcile-stripe-migration.mjs`: assumed mapping 190–193, email/old-ID first match 200–215, patch 230–234 | Writes `families.stripe_customer_id` and display card fields from an old/new-customer mapping. It does not transfer cards, establish merchant-scoped identity, attach/validate PaymentMethods or create subscriptions. Actual Stripe Mindbody-source mapping shape must be supported explicitly. |
| C8 [C] | `scripts/backfill-card-shadow-columns.mjs`: selects `stripe_connected_customer_id` and location account; `supabase/functions/stripe-create-subscription/index.ts` uses the connected-customer field | Connected billing uses a different customer field from C7. Card shadow data is display metadata, not proof a method is usable or in the correct account. Shared families need topology design. |
| C9 [C] | `portal/app/api/stripe/connect/start/route.ts`: location account at 71–117; new-account card capability request at 99 | Per-location connected-account model. This does not prove production KYC, capabilities, payout routing or migration destination eligibility. |
| C10 [C] | `supabase/functions/stripe-create-subscription/index.ts`: customer/price parameters 400–408, anchor/proration 417–425, creation 428 and first-invoice confirmation thereafter | New-enrollment code can confirm an initial PaymentIntent. Optional day-of-month anchoring is not preservation of arbitrary legacy due instants/timezones. Do not run as a bulk migration tool; future staging/holds need separate design and tests. |
| C11 [C] | `portal/app/api/owner/enroll/attach-payment/route.ts`; `supabase/functions/stripe-webhook/index.ts`; `supabase/functions/collect-scheduled-charges/index.ts` | Enrollment, event lifecycle and deferred/split collection paths exist. Not evidence of live account/scheduler/event/email configuration. Scheduled balance collection differs from Stripe-managed subscription renewals. |
| C12 [C] | `portal/app/owner/billing/BillingContent.tsx`: demo arrays 28–36 and live-data fallback 70–73; `portal/lib/supabase/ownerQueries.ts` | Empty live data can display demo packages/transactions. Require clean non-demo acceptance and ledger tie-outs, including missing-write scenarios. |
| C13 [C] | `src/api/bookings.ts`; `src/screens/Coach/CoachInbox/CoachMessageThreadScreen.tsx`; `portal/app/coach/*`, `portal/app/owner/*`, `portal/app/hq/*` | Role surfaces and booking/check-in APIs support demo candidates. No blanket claim all role workflows have passed. Recheck actual current behavior, not old marketing or task titles. |
| C14 [C] | `src/screens/Auth/WaiverScreen.tsx`; `portal/app/api/admin/waivers/[familyId]/pdf/route.ts` | New waiver signing and PDF generation exist. They do not prove import of original Mindbody agreements, forms or signature audit trails. |
| T1 [T] | `docs/payment-validation-report.md`, dated 10 July 2026, Frisco Stripe test-mode scope, coverage §2 | Documents onboarding, one-time/split/deferred charges, renewals, failures/retries, cancellation, reporting and signed replay. Not live Clearwater/network certification. Raw execution history was not independently reproduced here. |
| U1 [U] | No real Infinite Hitting source exports or account-specific vendor replies supplied | Real export compatibility, record counts, no-re-entry and merchant topology remain unproven. |
| U2 [U] | No manifest-backed rollback tool/rehearsal verified | UUIDv5 hashes do not preserve namespace prefixes. Never use a namespace-prefix deletion assumption as rollback evidence. |

Primary provider claims are sourced S1–S5 in the owner briefing. The newly accessible Mindbody FAQ narrows earlier uncertainty: whole-site/cancellation restrictions and document exclusions are published; account-specific applicability remains open.

## Backlog—not implemented or silently included in this task

Prioritize critical migration gates above demo polish. The existing tasks below were supplied as **PROPOSED**, not completed evidence. Their current task records should be checked by the implementation owner; a description is not a shipped capability.

| Work area / accountable lead | Existing work or disposition | Required acceptance before relevant cutover |
|---|---|---|
| Real export compatibility / engineering | [Task #253](#existing-task-253) — existing proposed work | Authorized real sample, source-site IDs, robust parsing, accurate statuses/dates/prices, explicit exceptions, future/credit/doc coverage decisions and paginated tie-outs. Do not duplicate this task. |
| Selective rollback / engineering + finance | [Task #254](#existing-task-254) — existing proposed work | Correct unsafe namespace-prefix assumption before implementation. Explicit batch/source manifest, change snapshots, dependency-safe selective restoration and rehearsal. Financial handback separately authorized. |
| Scheduled balance execution / engineering + operations | [Task #558](#existing-task-558) — existing proposed work | Prove registration, execution, target environment, alerts and error handling. Not the same as Stripe subscription retry scheduling. |
| Live billing report evidence / finance + engineering | Existing Task #273, “Wire the Billing page transaction list to real payment_events with the same date filter”; existing Task #274, “Backfill existing members’ card details from Stripe into the database” | Verify actual task/code outcome. Eliminate demo evidence from acceptance; card shadow backfill is not portability. Do not duplicate existing work. |
| Pause/cancel operations / operations + engineering | Existing proposed #256 auto-resume and #259 effective-date cancellation jobs | Confirm deployed registration/execution and compatibility with staged migration authority; do not infer production operation from `docs/RUNBOOK.md`. |
| Card mapping and Connect topology / engineering + providers | Separately scope after written provider eligibility; not covered by the current reconciliation helper | Actual returned schema, merchant/source-ID crosswalk, correct connected-customer/default-method validation, shared-family policy and no unreviewed writes. |
| Safe future schedule/handoff / engineering + finance | Separate migration-specific work, not ordinary enrollment | No immediate collection, exact legacy due/timezone/terms, idempotent review/hold, old-stop proof and single retry owner; test duplicate/in-flight/late-stop cases. |
| Credits/bookings/documents and legal archives / manager + counsel + engineering | Scope after actual export inventory; no native migration guarantee | Per-record entitlements and future rosters; original-file manifest/checksums/retrieval; explicit unsupported-data handling and retention approval. |

### Existing Task 253

“Run the MindBody import against a real MindBody export to find edge cases.” Supplied state: PROPOSED. Match this existing project task by reference/title; do not duplicate it.

### Existing Task 254

“Add a delete / rollback script to undo a MindBody import.” Supplied state: PROPOSED. Amend the unsafe namespace-prefix assumption before implementation; match the existing project task rather than creating a duplicate.

### Existing Task 558

“Register the balance-charge cron job so it runs automatically every day.” Supplied state: PROPOSED. Registration and actual execution require environment evidence.

Links above navigate to exact existing-task references within this appendix, not to invented project URLs. Local task files were not present; use project task search by the supplied reference/title to open their current records.

## Evidence capture format for the next phase

For each requirement record: evidence label, environment/test versus live, site/location/account, relevant batch/source IDs, actual observation, timestamp/timezone, reviewer, secure evidence link, exceptions and expiry/recheck date. Keep sensitive exports/payment references out of this public/shareable pack.

The operations workbook specifies proposed controls. A passing gate requires actual observed evidence, not this document, a draft task, a synthetic status edit, seeded screens or the “production-ready” heading in an older test report.
