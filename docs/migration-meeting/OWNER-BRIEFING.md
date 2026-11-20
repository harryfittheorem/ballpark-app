# Mindbody → Ballpark by Infinite Hitting
## Owner decision briefing

**Prepared 12 November 2026 · Clearwater first · 20+ locations, sequential rollout**

**Scope update:** Infinite Hitting has requested removal of the HitTrax integration and related functionality. This is planned work, not completed removal. The new five-slide presentation reflects that direction; existing HitTrax code below is implementation evidence, not a feature proposed for launch. Preserve non-HitTrax booking, coaching and rewards, and review dependent statistics, achievements and historical-data retention before removal.

### The decision today

Authorize discovery and a **gated Clearwater pilot**, targeting 30 days only if provider lead times, legal review, data quality and operating readiness support it. This is not permission to cancel Mindbody, disable autopays, charge families, incur unapproved vendor fees or launch the network. Each financial cutover needs separate written approval.

**Please confirm: did you intend a 30-day Clearwater pilot target or a network-wide deadline?** This pack assumes Clearwater. If the intent was network-wide, agree a revised scope and feasibility assessment before committing to dates.

The objective is uninterrupted, accountable revenue and member access—not simply importing records or installing an app.

### Three non-negotiables

1. **No card re-entry is a required outcome, not yet a proven capability.** Owners have already made that promise. Written processor eligibility and verified account-scoped card mappings are cutover gates. If any relevant card/vault/account/payment type is ineligible or delayed, retain affected members on old billing where permitted, postpone their cutover, or seek explicit owner approval to revise the promise. Do not quietly replace it with a card-update campaign.
2. **One authorized collector per member at a time.** Mindbody billing stays authoritative until the replacement is verified and old collection is confirmed disabled for that member. New collection cannot start merely because an imported membership says “active.”
3. **No unexplained financial or mapping differences.** Account for every in-scope member, obligation, credit and exception; reconcile collections and settlements, not counts alone. Legitimate declines may occur and must be distinguished from migration failures.

## 1. What is built—and what that proves

Evidence labels throughout this pack:

- **[C] Code-present:** implementation exists in the repository inspected on 12 November 2026; not proof of deployment or successful live operation.
- **[T] Documented test evidence:** a dated report describes a test; scope and environment remain limited.
- **[V] Vendor-confirmed:** published official guidance supports the general claim. **No account-specific written confirmation for Infinite Hitting was supplied.**
- **[U] Unverified:** requires samples, environment checks, professional review or written provider confirmation.
- **Proposed control:** a required future procedure, not a claim that tooling already enforces it.

| Audience / workflow | Evidence and demo candidate | Migration / live-readiness boundary |
|---|---|---|
| Families: account, athlete profiles, booking and cancellation | [C] Mobile screens and booking API exist. Demonstrate invite/password setup, correct household, available slot, booking and cancellation. | [U] Imported family identity, sibling and cross-location permissions, unused credits and future bookings need acceptance. Password portability is not promised. |
| Families: coaching and engagement | [C] Video messages, assignments, rewards and rankings exist. Demonstrate a clearly labelled non-HitTrax sample story. Existing HitTrax surfaces are planned for removal. | [U] Delivery, permissions, HitTrax-dependent rewards/statistics and current device distribution must be reviewed. Engagement/retention improvements are not proven outcomes. |
| Coaches: sessions, check-in, inbox and assignments | [C] Coach mobile/portal surfaces and check-in API exist. Demonstrate assigned-family access, attendance and drill feedback. | [U] Location/staff mapping and actual shift workflows need validation; a screen is not proof every role action works. |
| Staff: enrollment, membership management, scheduling and waivers | [C] Portal routes, enrollment/payment paths, waiver signing and PDF generation exist. | [U] Legacy agreements, permissions, source document completeness, training and exceptions need signoff. New signatures do not replace old evidence automatically. |
| Owners / HQ: location, revenue and member oversight | [C] Owner/HQ routes and queries exist. Demonstrate location filters and a traceable transaction/report. | [U] Clean live reports and all-location completeness are unverified. Billing UI falls back to demo content when live data is empty; attractive numbers are not acceptance evidence. |
| Payments: new enrollment, renewals, failures and recovery | [C] Connected-account billing and webhook code. [T] 10 July 2026 Frisco Stripe test-mode report documents payments, renewals, declines, retries and replay. | Not live Clearwater certification or 20+ location acceptance. [U] Live capabilities, payouts, delivery, schedulers, email and reconciliation. |
| Migration: clients, memberships, past visits and sales | [C] Four import scripts and a validator exist. | [U] No real Infinite Hitting exports supplied. Imported active EFT rows do **not** create subscriptions, transfer cards or preserve next billing dates. |
| Card migration / cutover | [V] Stripe documents secure processor transfer separately from subscription migration. | [U] Mindbody eligibility, Connect destination, usable payment methods, handoff automation and selective rollback are not established. |

**Demo discipline:** use labelled sample/test data and narrate boundaries. Do not run an import, seed a live environment, or take a live payment for this meeting. Rehearse the five critical journeys in the agenda with approved test fixtures. Existing older marketing documents contain hypotheses and outdated pilot figures; they are not the source of migration promises.

## 2. Provider dependencies that can change the plan

**[V] Mindbody’s current Subscriber data export FAQ was retrieved successfully on 12 November 2026** (article dated 26 August 2026). Earlier planning could not retrieve its body; that limitation is now partly resolved. The FAQ says:

- Subscriber data export is a paid service for customers cancelling their software. Only the listed data owner can initiate it; verification is required and cannot be delegated to staff.
- Exports cover the **entire site**, cannot be customized to a single location, and are unavailable where only some locations in a datashare site are cancelling.
- It lists autopay contracts, balances, relationships, sales, payments, attendance/appointments, trainers, gift-card balances and documents among export content. Card/bank information requires a PCI-compliant recipient with PGP capability. This is a published category list, not a validated Infinite Hitting file specification.
- Waiver export covers **status and date signed, not the actual waiver document**; client forms are excluded. Appointment notes and unpaid visits also have exclusions or separate-report requirements.
- Price must be obtained from the cancellation agent. The FAQ describes five business days after correct security verification and owner authorization, but verification may take hours to weeks. This is not a confirmed project delivery date.
- It describes post-cancellation access/request limits and a 30-day download-link expiry. Preserve verified archives before losing access; do not trigger cancellation simply to obtain an export.

**Critical [U] question:** Is Clearwater an independent source site, or part of a shared site/vault? Obtain a written, revenue-safe export/transfer arrangement **without premature loss of billing or data access**. If published cancellation/export restrictions conflict with that arrangement, stop and redesign the pilot with providers and owners. Do not assume report exports solve saved-card portability.

**[V] Stripe’s official import guide** describes provider-encrypted data sent over dedicated SFTP, Stripe validation, explicit approval and a returned source-to-Stripe ID mapping. It separates payment-method import from subscriptions/invoices. It describes typical processing around **10 business days after valid data and all requirements arrive**, with predecessor exports ranging from days to months; this is not an SLA or Mindbody-specific duration. A new merchant identifier can temporarily change authorization rates; staged ramp-up is recommended.

**[U] Confirm destination eligibility:** the app models one connected Stripe account per location. Providers must approve the actual legal-entity, merchant, vault, site and connected-account topology. A Mindbody Payments account that uses Stripe underneath is not automatically a Ballpark-owned account or an approved Stripe-to-Stripe copy. Request PaymentMethod (`pm_`) output where appropriate and validate the actual returned schema.

## 3. Migration inventory and acceptance

All rows below are **proposed mapping/acceptance requirements**. Source availability and exact target support remain [U] except the limited [C] import coverage in section 1.

**Identity rule:** key records by source system + source site/location + source record ID; preserve leading zeros. Email is an attribute, not the sole identity key. Maintain a reviewed crosswalk to target IDs and batch provenance.

| Data / obligation | Source → target or archive | Required acceptance and accountable role |
|---|---|---|
| Adults, athletes, households, guardians | Client and relationship IDs → family/kid/account crosswalk; retain legal guardian relationships and communication preferences | Operations + engineering: every in-scope identity resolved; duplicates, missing email and shared-family conflicts explicitly handled. Invitations/password setup separate from card entry. |
| Staff, roles and locations | Staff/site/location IDs → approved target roles and location links | Clearwater manager: permission matrix, terminated staff excluded from access, named staff see only permitted records. No first-location defaults. |
| Plans and grandfathered pricing | Contract/pricing IDs → target plan/price and original terms | Finance: amount, currency, frequency, tax, discounts, proration and service entitlements tied out per member; no silent standard-price substitution. |
| Recurring and installment obligations | Autopay/contract IDs → future schedule and obligation register | Finance + engineering: next due instant/timezone, paid-through, last charge, arrears, remaining installments, pause/resume/cancel dates preserved; unknown is not zero or cancelled. |
| Saved payment methods | Processor source customer/payment IDs → approved merchant-scoped Stripe customer/PaymentMethod mapping | Providers + engineering: usable default method on correct connected account; ownership and authorization checked. Last-four display alone is insufficient. No PAN/CVC in business import. |
| Unused sessions, packs, balances, gift cards | Source liability IDs → validated entitlement ledger, or approved controlled operational register until native support is verified | Finance + manager: opening quantity/value, expiry, restrictions, transfers and usage tied out. If present but unsupported, block relevant cutover unless a tested approved operating procedure preserves them. |
| Upcoming bookings, waitlists, recurring reservations | Booking IDs → location/resource/coach/athlete slots with entitlement links | Manager: final future roster matched, timezone/capacity/conflicts resolved; no duplicate booking notifications. Current historical-visit importer does not cover this. |
| Historical attendance and sales | Source transaction/visit IDs → labelled historical records plus immutable source archive | Finance: date range, refunds, quantities, totals and source references reconciled. Historical payments are **not new cash collection**, and must not double-count current revenue. |
| Refunds, disputes and open balances | Original processor references → restricted case register and retained financial reports | Finance: original processor retains assigned case/refund responsibilities until settled; owner-approved funding/reserve plan. Do not assume Stripe can refund a Mindbody charge. |
| Signed contracts, waivers, attachments | Original files + source IDs + signer/date/version + available audit evidence → access-controlled legal archive; target link only after support is validated | Counsel + records custodian: file checksum, expected/received/missing report, retrieval test and retention policy. Status/date alone is not signed evidence; source-hosted URLs alone are not durable archives. |
| Financial/legal history not needed day-to-day | Tax/payroll/settlement reports and originals → retained archive, not necessarily app rows | Finance + counsel: retention, access, legal hold and deletion schedule approved; source closure prohibited until completeness is accepted. |

**Legal gate [U]:** counsel must assess contract continuity/assignment, recurring-payment authorization, merchant changes, notices, privacy/minor data and retention. Preserving a signed agreement is different from requesting a new waiver. Do not backdate or claim a new signature retroactively establishes old authorization.

**Security control:** never route PAN/CVC through Ballpark, this Repl, team email, CSV attachments or logs. Card data moves only through the authorized processor/Stripe PCI workflow. Ordinary exports still need encryption, least privilege, an approved secure exchange, access logging and timed deletion. Do not commit real exports or populated registers to this repository.

## 4. How billing continues

**Proposed control—not implemented migration automation.**

1. Baseline the next obligations while Mindbody remains authoritative. Confirm old-provider continuation, retry and per-member stop capabilities in writing.
2. Transfer cards provider-to-provider and verify the account-scoped crosswalk. Separately recreate exact legacy prices and future subscriptions/schedules in a safe reviewed state. The existing new-enrollment subscription endpoint may charge immediately; it is **not** an approved migration staging tool.
3. Validate next charge, paid-through, amount, taxes, discounts and absence of migration-day invoices or unwanted proration. Rehearse differing billing dates, month-end/timezones, pauses, cancellation, installments and failures.
4. At an approved handoff, record proof that old autopay and pending retry collection are disabled for this member. Only then permit the new schedule to collect. If stop proof or safe scheduling is uncertain, hold the handoff. A future schedule can activate automatically: an operator must cancel/hold it before its deadline if old-stop proof is missing.
5. Maintain one charging-authority register, including held-on-old members. Assign retry ownership to exactly one system for each debt; Stripe handles its subscription retries after handoff, not a second independent collection loop.
6. Finance reconciles scheduled → attempted → paid → ledger → settlement/bank by location/date, with separate declines, pending amounts, fees, refunds and disputes. Missing ledger writes or synthetic/demo report rows fail acceptance.

Failed/incomplete transfers remain on Mindbody only if the providers permit continued service. Synchronize entitlements, bookings and payment status with a reviewed daily exception process. If continuation is not available, postpone cutover and escalate; do not improvise collection or card re-entry.

## 5. Conditional 30-day Clearwater plan

**Presentation roadmap update:** the owner discussion now proposes about two weeks for HitTrax removal/stabilization, then internal scenario testing, an owner/staff hands-on trial, about one week of non-collecting shadow comparison with Mindbody, and a separate go/no-go for a small Clearwater cohort. Each stage exits on evidence and signoff. Mindbody remains authoritative during shadow operation; no automatic synchronization or duplicate live actions are assumed. Testing, trial, remediation and provider delays add time: reforecast the earlier 30-day target rather than forcing these stages into it. The day ranges below are the earlier illustrative planning windows, not an approved cutover commitment.

Day 1 begins after owners authorize discovery and assign people. Calendar dates are to be agreed; no automatic financial go-live date is set.

| Window | Deliverable and lead role | Gate / evidence needed |
|---|---|---|
| Days 1–5 | Owner sponsor + migration lead: inventory sites/entities/vaults, baseline obligations, request exports/transfer, confirm pricing and provider timing | Written Clearwater eligibility, safe ongoing billing and destination feasibility. By Day 5 escalate any unsupported timeline; never wait until cutover week. |
| Days 6–12 | Engineering + finance + manager: sample mapping, isolated dry run, separate readiness fixes, archive/credit review and account onboarding | Record-level exception report, tie-outs and acceptance tests. Old billing remains authoritative. Real exports have not yet been supplied. |
| Days 13–20 | Migration lead: full rehearsal, delta/cutoff practice, card/schedule validation if available, staff training and approved notices | Rehearsed no-double-collection handoff and fallback; representative test renewals/retries; no unresolved critical defects. |
| Days 21–25 | Sponsor + finance + operations: explicit go/no-go for bounded Clearwater cohorts | All workbook gates passed, final delta verified, approved authority register; no unapproved live tests or charges. |
| Days 26–30 | Manager + finance + engineering: staffed hypercare, daily obligations and settlement checks, owner progress review | Report real outcomes and open exceptions. A full monthly billing cycle may extend beyond Day 30; the pilot is not yet network-proven just because the calendar ends. |

**Vendor/readiness delay:** keep Mindbody billing and postpone financial cutover. App-only soft launch is optional and separately approved, only if access, bookings and balances can remain accurate with an explicit system of record and no hidden duplicate billing. App distribution/review timing is a dependency; Apple approval is not guaranteed.

**After Clearwater:** require representative authorized live renewals, observed recovery handling, settlement tie-outs and an appropriate real billing cycle before calling the pilot proven. Agree operational service measures and monitoring thresholds before launch. Prepare later sites in parallel if useful, but activate **one location at a time** with fresh signoff. Shared-vault transfers may need centralized coordination even when customer rollout is sequential.

No invented network completion date: after the pilot, estimate throughput from vendor capacity, location complexity, exception resolution and cycle observation. Each later location repeats inventory, dry run, delta, cutover, hypercare and cycle acceptance.

## 6. Responsibilities and approval boundaries

These are **role owners to be assigned to named people at the meeting**, not claims that people have already accepted duties.

| Role | Accountable outcome / authority |
|---|---|
| Infinite Hitting executive sponsor | Confirm scope/deadline, appoint owners, approve budget and each cutover; approve any change to no-re-entry promise. |
| Listed Mindbody data owner per site/entity | Initiate vendor export verification personally; control contractual notices. Discovery does not authorize cancellation. |
| Migration lead | Maintain inventory, evidence log, dependencies, cohort register, cutover checklist and stop/escalation coordination. |
| Engineering lead | Code/data gap assessment, isolated rehearsal, merchant-scoped mappings, monitoring and selective rollback evidence; no unilateral live collection authority. |
| Finance lead | Baseline obligations/liabilities, prices/tax review, charging-authority dual approval, daily reconciliation and authorized reversal decisions. |
| Clearwater operations manager | Staff roster, bookings/credits accuracy, training, coverage and family support signoff. |
| Counsel / privacy and records custodian | Authorization/contract continuity, required notices, original evidence retention and secure archive approval. |
| Mindbody Payments/Data Services + Stripe migration/Connect teams | Written eligibility, topology, transfer process, file formats, timing and support contacts; providers own secure card transfer. |

## 7. Risk register

All risks are open until evidence is recorded; priority is a proposed severity, not a measured incident probability.

| Risk / priority | Early warning or trigger | Owner / mitigation and stop condition |
|---|---|---|
| Shared-site export prevents isolated pilot / critical | Clearwater shares a datashare site or cancellation required before safe handoff | Sponsor + providers: written safe arrangement; otherwise redesign/hold. No premature network cancellation. |
| No-re-entry promise cannot be met / critical | Unsupported vault, method, entity or destination; missing usable defaults | Providers + sponsor: retain on old where supported or defer; explicit revised-promise approval required for alternatives. |
| Double charge or missed obligation / critical | Overlapping active collectors, pending old retry, unowned next due | Finance: member authority register and future-activation hold; stop cohort on any duplicate or unexplained gap. |
| Wrong family or merchant / critical | Email collision, repeated source IDs, multi-location household | Engineering: site-scoped identity and account crosswalk, independent review; unresolved mapping blocks handoff. |
| Lost entitlements or documents / high | Missing credits, future booking, forms or signed evidence | Manager + counsel: separate reports/archive, checksum/completeness tests; block affected scope until approved handling. |
| Misstated revenue / high | Historical sales mixed with live cash, ledger omissions or demo fallback | Finance: period/source separation, event-level and bank tie-outs; zero unexplained variance before expansion. |
| Vendor lead time exceeds target / high | No written timeline by Day 5; invalid transfer data | Migration lead: early escalation, revise dates, preserve old billing. No 30-day guarantee. |
| Live operation/configuration fails / critical | Webhook delivery, capabilities, scheduler or email checks fail | Engineering: target-environment evidence and alert coverage; no cutover with critical defects. |
| Decline rate changes / high | Increased declines after merchant change | Finance + providers: controlled cohorts, compare baseline and investigate codes; do not promise no declines or retry on both systems. |
| Staff/family confusion or app delay / high | Untrained shift, duplicate notices, distribution unavailable | Manager: rehearsal, approved instructions and staffed support; defer app onboarding if access cannot be supported. |
| Unsafe rollback / critical | No batch provenance or post-charge handback plan | Engineering + finance: rehearse selective restore; after charges reconcile processors/ledger before any authorized handback. |

## 8. Owner FAQ

**“You promised families would not re-enter cards. Are you backing away?”** No. It remains a required outcome. We will not move affected billing until processors prove it works for those accounts. We will not conceal an unsupported transfer with a card-update campaign.

**“Can we finish in 30 days?”** Target a gated Clearwater pilot. Vendor verification/export/import and readiness determine feasibility. A complete billing cycle and all 20+ locations are not promised in that window.

**“Is the product ready or not?”** There is substantial code and useful Frisco test-mode payment evidence. That is different from a proven Mindbody migration and live Clearwater operating acceptance. The internal appendix lists the remaining work.

**“If Mindbody Payments uses Stripe, isn’t this just copying accounts?”** Not necessarily. Merchant ownership, account access, data rights and Connect destination rules must be confirmed by the providers.

**“Does importing an active membership preserve autopay?”** No. A row is not a usable card, payment authorization or recurring schedule. Those require separate migration and verification.

**“Do families have to create accounts or sign again?”** Invitations/password setup may be needed and are different from card entry; old passwords are not promised portable. Counsel decides whether new agreements/notices are needed. A new waiver does not erase original signed evidence.

**“Will every signed waiver move into Ballpark?”** Not proven. Mindbody’s FAQ excludes actual waiver documents and client forms from that export. Obtain originals through an approved separate process where available, preserve evidence and resolve missing items with counsel.

**“What will it cost?”** No approved quote is supplied. Obtain export/verification, processor/migration, Stripe Billing/Connect/processing, overlap-service, engineering, archive, support and legal costs. Approve a budget before commitments; do not assume free transfers or savings.

**“Can we undo it?”** Before charging, selective data rollback requires explicit batch provenance and rehearsal. After charging, deletion does not undo transactions, restore autopay or reinstate agreements. Finance and providers must authorize a reconciled handback.

**“Will there be no declines or downtime?”** Those cannot be guaranteed. The plan controls collectors, catches gaps, preserves fallback where supported and monitors settlements. Normal declines are tracked separately from migration-caused loss.

## 9. Primary-source record

Accessed **12 November 2026**. Page dates are shown only where visible. These are general official publications, not account-specific approvals. Reconfirm before execution.

| Ref | Official source / access result | What it establishes / limitation |
|---|---|---|
| S1 | [Stripe: Import payment data](https://docs.stripe.com/get-started/data-migrations/pan-import) — full body retrieved; no publication date shown | Encrypted processor/SFTP workflow, validation approval, ID mapping, PaymentMethod option, separate billing migration, typical timelines and authorization-rate warning. Does not approve Infinite Hitting’s Connect destinations. |
| S2 | [Stripe: Migrate subscriptions using APIs](https://docs.stripe.com/billing/subscriptions/import-subscriptions) — full body retrieved; no publication date shown | Default payment source, legacy prices, customer/price mapping, billing continuity, sandbox tests and future subscription schedules. Does not prove existing Ballpark importers implement these requirements. |
| S3 | [Mindbody: Subscriber data export FAQ](https://support.mindbodyonline.com/s/article/I-need-to-export-my-Data-Subscriber-Data-Export?language=en_US) — body retrieved despite cookie-banner error; dated 26 August 2026 | Export categories, cancellation/owner/security restrictions, shared-site limitation, pricing inquiry, timing, exclusions and download/access limits. Exact Infinite Hitting eligibility and arrangements remain unverified. |
| S4 | [Mindbody developer portal V6](https://developers.mindbodyonline.com/PublicDocumentation/V6) — navigation and Getting Started body retrieved | Developer account, sandbox, live approval and owner site activation are documented. Endpoint completeness for this inventory, API permissions, charges and document access were not verified. |
| S5 | [Mindbody legacy card-transfer article](https://support.mindbodyonline.com/s/article/208833188-Can-I-move-my-customer-s-credit-card-information-to-a-new-billing-software?language=en_US) — Invalid Page/error, body unavailable | No capability claim based on this page or its search snippet. Use S3 and obtain written provider answers. |

Internal evidence: current repository and the [technical appendix](TECHNICAL-APPENDIX.md); documented Frisco test scope in `docs/payment-validation-report.md` dated 10 July 2026. Its broad “production-ready” wording is **not adopted as migration or live Clearwater certification**.
