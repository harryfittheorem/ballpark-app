# Migration operations workbook

**12 November 2026 · proposed procedures and empty templates, not completed operational evidence**

Use with the owner briefing. All actions below require the relevant owner authorization; none was executed for this documentation task. Record each gate with evidence location, reviewer, date/time and result. “Unknown” means hold, not pass.

## A. Discovery and topology sheet

Complete one row per location, then review shared dependencies across the entire network:

| Field | Value to collect / decision |
|---|---|
| Business topology | Location, legal entity, listed data owner, Mindbody site ID, datashare group and source location ID |
| Merchant topology | Existing processor/vault owner, merchant ID, payment types, shared-family/card rules and payout beneficiary |
| Target topology | Ballpark tenant/location ID, connected account, legal entity and currency, payout beneficiary and approved transfer destination |
| Operating scope | Active plans/statuses, obligations, future bookings, packs/credits/gift cards, history period and document categories; actual counts pending approved exports |
| Service continuity | Last source-access date, cancellation terms, export/transfer lead times, per-member stop/retry behavior, continuation permission and support contacts |
| Costs and access | Written quote, owner approval/cap, secure transfer roles, retention/deletion dates and legal holds |
| Readiness decision | Independent Clearwater pilot feasible / requires shared-site coordination / blocked; reviewer and evidence |

Do not infer merchant ownership from branding or from the processor name “Stripe.”

## B. Owner-authorized vendor request drafts

**Draft only. The listed Mindbody data owner must initiate the export request; staff cannot substitute for required owner verification.** Fill identifiers only in the approved secure vendor channel. Obtain a quote and owner approval before requesting a paid execution. Do not email customer exports, bank credentials, PAN or CVC.

### To Mindbody account representative, Payments and Data Services

Subject: Discovery only — Infinite Hitting Clearwater export and payment continuity feasibility

“I am the listed data owner for [entity/site]. We are evaluating a Clearwater-first move to Ballpark by Infinite Hitting using Stripe Connect. This inquiry does not authorize cancellation, disabling autopays, fees or an export execution.

Please confirm in writing:

1. Which site/datashare group, locations, legal entities, merchants and vaults cover Clearwater? Your Subscriber data export FAQ says whole-site/cancellation restrictions apply. Can a Clearwater pilot be supported while remaining locations and affected members continue billing? What approved alternatives, if any, exist? If not, please state the constraint rather than starting cancellation.
2. What exact owner verification, forms, permissions and notice are required? What events start cancellation/access-loss clocks? Can discovery, sample business files and secure card-transfer preparation occur without terminating service?
3. Provide a business export schema/data dictionary and approved sample for identities/relationships, staff/locations, contracts/pricing, status/pause/cancel dates, next billing/timezone/paid-through, taxes/discounts, installments, credits/packs/gift cards, bookings/waitlists, history and open refunds/disputes. Which categories require separate reports? How are deltas, deletions and a final cutoff captured?
4. Identify the actual payment-data custodian and supported card/bank types. Can eligible saved methods transfer directly to Stripe’s approved connected-account destinations without customer card re-entry? What is excluded (including tokens, wallets or account types), and who coordinates encrypted PGP/SFTP delivery? Do not send card data to our team.
5. Can individual old autopays and pending retries be stopped with timestamped proof while others remain authoritative? How are in-flight charges, reversals, refunds, disputes and retained access handled? Confirm whether financial handback or continued billing for held members is permitted.
6. Your FAQ excludes actual waiver documents and client forms. How can originals and available signature audit evidence be separately preserved? Confirm formats, source links/IDs, signer/date/version, missing categories, availability and any retrieval deadlines.
7. Provide itemized fees, quote validity, queue/security/export/transfer timelines, dependencies, file/link expiry, retention/access after cancellation, support escalation and accountable contacts. Confirm when fees would be charged and require explicit approval first.

Please distinguish general policy from approval for our exact accounts. Our pilot target is conditional; no operational cutover occurs until billing continuity and no-re-entry gates are met.”

### To Stripe Data Migrations and Connect support

Subject: Discovery — Mindbody payment migration into location-scoped Connect accounts

“We are evaluating a gated Clearwater pilot for Infinite Hitting, later expanding sequentially across 20+ locations. Existing billing must remain authoritative until a verified handoff. No live billing change is authorized by this inquiry.

Please confirm:

1. Is the proposed transfer eligible from the identified Mindbody custodian/vault to [platform + connected-account topology]? Does underlying Stripe processing change the required route? Identify legal-entity/ownership, country/currency, account-type and payment-type restrictions, and shared-family/multi-location handling.
2. Should imports create customers or map existing customers separately on each connected account? Request PaymentMethod (`pm_`) output compatible with our integration. Provide the actual returned schema, account identifier, source customer/payment IDs, duplicate behavior and validation/exception reporting.
3. What secure processor contact, PGP/SFTP, PCI documentation and approvals are required? Arrange sensitive payment data directly with the custodian, never our app/workspace/email.
4. How do we verify usable default methods and recurring/off-session authorization without an unauthorized charge? Identify required customer action, mandates/notices and unsupported methods. No card re-entry is our required gate, not an assumption.
5. Confirm the supported future subscription/schedule approach preserving original next due date/timezone, paid-through term, legacy amount/frequency, taxes, discounts, pauses, cancellation and installments with no immediate collection or unwanted proration. How can activation be held/cancelled if old-provider stop evidence is late?
6. Confirm Connect live capabilities, payout setup, webhook event/account requirements and staged authorization-performance guidance. What tests and acceptance evidence do you recommend?
7. Provide fees, lead-time dependencies, queue dates, validation/approval process and escalation contacts. We understand published typical processing is not a project SLA. Can failed mappings be corrected/delta-imported without duplicate objects?

Please provide account-specific written answers; do not initiate charges or subscriptions. Our listed data owner will separately authorize any provider execution and cost.”

### To counsel / records custodian

“Please review existing agreements and payment authorizations for merchant/system changes, assignment/continuity, required notices/consent and minor/guardian data. Specify what original signed documents/audit trails must be retained, retrieval/retention/legal-hold rules, handling of missing waivers/forms and whether prospective new signatures are required. Distinguish preservation from re-signing; do not assume a new waiver replaces prior evidence. Approve family wording and any change to the no-re-entry commitment before release.”

## C. Acceptance checklist and evidence log

Use **result: pass / hold / fail**, named reviewer, dated restricted evidence reference and remediation owner for every item. A checkbox here is not evidence.

### Gate 0 · Discovery authority

- [ ] Sponsor confirmed Clearwater versus network deadline, assigned named people and approved discovery budget/secure access.
- [ ] Every in-scope site/entity/vault/account mapped; shared-site constraint and safe source continuation resolved in writing.
- [ ] No-re-entry eligibility confirmed for each relevant payment/account type; unsupported/delayed cases have approved handling, never silent omission.
- [ ] Vendor lead times, quote, cancellation/access risks and Day 5 escalation reviewed.

### Gate 1 · Data and legal rehearsal

- [ ] Real authorized sample export tested in isolation; exact schema, quoting, encodings, dates/timezones, nulls and leading zeros validated.
- [ ] Every source record has site/location/source ID and explicit batch provenance, target mapping or a named exception.
- [ ] Per-location/per-batch paginated accounting proves: source in-scope = accepted + held exceptions + approved exclusions, with no duplicate classification. Unknown counts are not zero.
- [ ] Every active member and liability is accountable; grandfathered price, next due, paid-through, tax, discounts, pauses/cancellations and installments reconciled.
- [ ] Credits, packs, balances, gift cards and future booking/resource rosters tied out; changes/deletions reconciled, not ignored on rerun.
- [ ] Original document completeness/checksums/retrieval reviewed; missing signed evidence explicitly resolved with counsel. Native target display is separately verified or secure archive access approved.
- [ ] Legal approval covers authorization, continuity, notices and privacy/retention—not inferred from an imported status.
- [ ] Selective pre-charge rollback rehearsed from explicit manifest with unrelated records preserved.

### Gate 2 · Billing and operating readiness

- [ ] Source → customer → usable default PaymentMethod → connected account → price → future schedule mapping independently reviewed.
- [ ] Staged schedules cannot collect before verified old-stop proof; deadline-monitor/hold procedure tested. No migration-day charge, duplication, unwanted proration or date shift.
- [ ] Success, decline, retry/recovery, pause, cancel, month-end/timezone, installments and webhook replay tested using authorized test-mode fixtures; legitimate decline handling is explicit.
- [ ] Clearwater **live** account capabilities (`card_payments` active), requirements, charges/payout eligibility and payout beneficiary verified in target environment.
- [ ] Live webhook configuration/signatures/account routing and actual delivery verified; scheduled job registration **and execution** checked, plus email/reminder delivery and alerts. Test-mode reports do not substitute.
- [ ] Clean reports show actual data or honest emptiness, not demo fallback; ledger completeness and historical/live separation verified.
- [ ] Each shift trained on family lookup, booking/credit changes, check-in, exceptions, payment issues and escalation. Actual device/build access validated; no Apple approval guarantee.
- [ ] Representative staff/family acceptance signed off; no unresolved critical defect.

### Gate 3 · Financial cutover approval

- [ ] Final source delta/cutoff and pending charge/retry inventory accepted.
- [ ] Zero unexplained mapping/financial variance; all legitimate exceptions assigned, approved and excluded from new collection where necessary.
- [ ] Finance + operations + sponsor signed the cohort, timestamp/timezone, monitoring coverage, stop conditions and fallback.
- [ ] One authorized billing system per member established with old-stop proof before new collection; held-on-old members have access/booking synchronization and reconciliation owners.

### Gate 4 · Expansion acceptance

- [ ] Representative authorized live renewals and real event/settlement outcomes observed; failures/retries traced without dual collection.
- [ ] Appropriate real billing cycle completed (may exceed Day 30); scheduled/attempted/paid/ledger/net payout tie-outs approved.
- [ ] Agreed operating measures met, no unresolved critical defects or duplicate charges; exception aging and support workload acceptable to owners.
- [ ] Sponsor approved the **next individual location**; no automatic network activation.

## D. Charging-authority register

Use `charging-authority-register.csv`. One row per **member obligation**, not just per email; separate rows for separate debts/plans. A family with multiple locations needs account-scoped mappings. No card numbers/security codes or private credentials belong here.

Required fields include batch/site/member/contract IDs; source and target location; old/new merchant/account; last successful old charge/reference; paid-through; next due instant/timezone/amount; old autopay and pending retry state; new customer/PaymentMethod/price/schedule IDs; old-stop evidence/time; staged-activation deadline; authority/handoff state; retry owner; exception owner; finance/operations approvals; reversal approval and monitoring evidence.

Allowed **proposed operating states**: `old_authoritative`, `staged_no_collection`, `old_stop_verified`, `new_authoritative`, `hold_on_old`, `handback_under_review`, `closed`. These are a workflow specification, not currently enforced app statuses.

Dual reviewer rule: finance checks obligation/collector, engineering checks account/schedule. Operations checks access. If old-stop proof is not obtained before a staged schedule’s safe hold deadline, cancel/hold its activation using the provider-approved process and verify the result. Do not trust a spreadsheet status to prevent a charge.

## E. Financial reconciliation template

Use `financial-reconciliation.csv` with one row per location + merchant account + currency + billing date/cohort. Keep record-level schedules, invoices/PaymentIntents and settlement evidence in approved linked restricted records. Do not aggregate different currencies or mix event dates and payout dates.

| Measure | Definition / required check |
|---|---|
| Scheduled count/value | Contractual obligations due in the window, plus approved arrears/adjustments, split between old/new collectors. Compare to source baseline and authority register. |
| Attempted count/value | Unique due obligations attempted; retries recorded separately, not new dues. Explain scheduled-but-not-attempted and cutoff timing. |
| Successful count/gross | Unique successful collections by processor reference; compare to processor and application ledger. Imported history excluded from new cash. |
| Declined / pending / held | Value and reason codes; retry owner/next action and aging. Distinguish normal issuer declines, timing and migration-caused gaps. |
| Refunds / disputes / fees | Separate processor movements and app records, including original-processor cases and reserves. No assumption new processor can reverse old payments. |
| Expected / actual net payout | Gross less refunds/disputes/fees, adjusted for documented holds/reserves/transfers and settlement timing. Match processor balance transactions/payouts to bank receipts when due. |
| Variances / signoff | Record processor-vs-ledger gross variance, payout-vs-bank variance, unattempted obligations and explanations with owner/resolution date; finance signs each period. |

Useful calculations (currency minor units):

- Unattempted due = scheduled obligations less obligations with at least one attempt, less documented approved holds/timing differences.
- Ledger gross variance = processor successful gross − application successful gross for the same source/time window.
- Expected net payout = settled gross − refunds − dispute debits − fees − reserve increases + reserve releases ± documented adjustments.
- Bank variance = expected bank receipts for payouts due − actual bank receipts, with pending settlement timing separately explained.

Avoid summing retries as separate sales or counting refund/dispute adjustments twice. **Zero unexplained variance** is required; it does not mean zero legitimate declines or zero unsettled timing items. Track each explained item to closure.

Cadence: finance baselines before cutover; migration lead checks every cohort handoff; finance reviews daily during hypercare and through the agreed billing cycle; engineering reviews event failures promptly. Agree support hours, alert thresholds and escalation contacts before go-live—none are claimed staffed yet.

## F. Cutover and contingency runbook

### Before the window

1. Migration lead obtains all Gate 0–2 evidence and written Gate 3 approval. Confirm provider support and safe continuation/handback terms. Rehearse holds before any live cohort.
2. Set exact cutoff timestamp/timezone, cohort list and change restrictions with staff. Capture baseline counts, obligations, liabilities, future roster, document manifest and in-flight charges/retries. Secure original exports and checksums.
3. Capture all changes since dry run: new clients, plan/price/status changes, cancellations, payments/refunds, credits used/added and bookings changed/deleted. Record delta sequence/capture time and source IDs. A “do nothing on duplicate” rerun is not delta reconciliation.
4. Engineering independently verifies correct accounts and staged schedules; finance verifies dues and no unwanted initial invoices/proration. Establish a safe activation hold deadline per staged record.

### During the window

5. Operations restricts writes in the agreed source scope for the bounded cutoff or keeps a reconciled manual change log if a freeze is not practical. Final delta is reconciled before authority changes.
6. Per member, verify no source in-flight collection conflict; obtain confirmed old-autopay/retry stop evidence. If uncertain, hold that member and cancel/hold impending new activation. Never assume a cancellation request means collection is off.
7. Only after stop proof, allow the reviewed new schedule’s approved activation; record exact time and authorized collector. Do not accelerate next due dates to create migration-day cash.
8. Verify access, remaining credits and future bookings immediately. Operations can hold onboarding/access changes independently of payment staging where needed. Reopen writes only after deltas and roles are correct.
9. Engineering checks event delivery and errors; finance checks actual due obligations/transactions/ledger. Do not create an unauthorized “test live charge” to prove readiness.

### Hypercare and stop rules

10. Staff a named support rota, publish approved support contacts and review financial/operational exceptions daily. Monitor charge results, retries, duplicate references, booking/access failures, document retrieval and settlements.
11. **Stop the affected cohort and further activation** for any duplicate collection, unexplained missing due obligation, wrong merchant/family, critical access/credit defect, missing old-stop proof or critical event/scheduler failure. Escalate immediately to migration lead + finance + sponsor; determine incident scope before expanding.
12. Preserve records and processor evidence. Do not delete data to hide a discrepancy or automatically refund/charge a family. Finance authorizes any corrective financial action and communication.

### Contingency by stage

| Situation | Safe response / required authority |
|---|---|
| Vendor delay or nontransferable methods, old provider supports continuation | Keep affected members old-authoritative, hold/cancel staged collection, synchronize entitlements and reconcile daily; sponsor revises dates. |
| Provider will not preserve old billing/access | Do not cancel or financially cut over under an assumed fallback. Escalate with providers/counsel/sponsor for a revised authorized plan. |
| Data defect before any new charge | Engineering restores only manifest-proven batch records/changes using a rehearsed selective process. Preserve pre-existing records and audit evidence. Stop any staged financial objects separately. |
| Failure after a new charge or invoice exists | Finance/provider-led incident and ledger reconciliation; inspect in-flight payments, retries, reversals, entitlements and settlements. Handback only with explicit approval, verified stop of new collection and confirmed old restoration. |
| App-only launch proposed | Operations signs a supported source-of-truth and delta process for access/bookings/credits; old billing remains sole collector. If accuracy cannot be maintained, defer. |

**Rollback limitation:** no verified migration rollback tool exists. Generated UUIDs do not retain a namespace prefix. Never delete by an assumed prefix; use explicit source-ID/batch manifests, change snapshots and selective rehearsal. Deleting imported records does not reverse payments, restore contracts or re-enable old autopay.

## G. Staff and family communication plan

All text is **draft**, subject to sponsor/counsel approval and actual provider evidence. No messages were sent.

| When | Audience / owner | Message and acceptance |
|---|---|---|
| Discovery | Data owners, manager and finance / sponsor | Explain limited authorization, source restrictions, sensitive-data rules and named responsibilities. No family “go-live” date yet. |
| Before rehearsal | Every shift and coach / manager | Teach lookup, bookings/credits, check-in, exceptions and who owns payment retries. Run scenarios and record competence/signoff. |
| After gates, before approved onboarding | Affected families / manager + counsel | Explain app access/invite/password setup, unchanged approved commercial terms, actual support channel, launch scope and any required notices. Only affirm verified no-re-entry for the eligible approved cohort. |
| At cutover / hypercare | Staff and affected families / manager | Confirm what changed, how to book/get help, approved statement descriptor/notices and billing authority. Do not tell held families their billing has moved. |
| Delay or incident | Affected cohort / sponsor + finance | Explain actual impact, retained billing arrangement and next update; never announce success without reconciliation. |

Family draft **only after relevant gates pass**:

“Infinite Hitting Clearwater is introducing Ballpark by Infinite Hitting for [approved services/date]. Your existing membership terms and next payment date remain as confirmed in your notice. You may receive an invitation to set up app access; this is separate from payment-card entry. Your approved card transfer has been verified, so you do not need to re-enter your card for this move. For help, use [verified support contact/hours]. Any separate action or agreement required will be explained clearly.”

Delay draft:

“We are postponing the billing change while provider checks are completed. [If confirmed: Your existing billing remains with Mindbody.] Please do not submit card details by email. We will confirm your app/billing arrangements and next update through [approved channel].”

Do not send either draft with unresolved placeholders or promises unsupported for that recipient. Invitations, delivery logs, failed emails and support outcomes need evidence; dispatch code alone is not proof of delivery.

## H. Repeatable location release sheet

For each next location: name/IDs/entity; sponsor approval; vendor eligibility; source-access dates; signed inventory; isolated dry run; exceptions/liabilities; archive acceptance; account/card/schedule evidence; training; cutoff/delta; cohort authority register; finance/operations cutover signatures; daily monitoring; real cycle reconciliation; lessons and next-location decision.

Preparation can overlap; activation cannot skip local gates. A central shared-vault migration is not approval to turn on every location.
