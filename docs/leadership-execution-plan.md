# Leadership Change Program — execution plan

**Status:** Proposed work breakdown for assigning owners; no implementation work is authorized by this plan alone.  
**Scope baseline:** `docs/leadership-change-specification.md` was approved by the creator on November 19, 2026, with decision gates retained.

## How to use this plan

This is an execution breakdown, not a launch schedule. Each work package is a separate assignable deliverable. “Suggested owner” means the team function best placed to lead; enter the actual person's name only after assignment. Estimate ranges are planning estimates, not commitments. Work requiring unresolved business rules must wait for the applicable decision IDs in the approved specification.

Start with **WP0, Policy decisions and task reconciliation**. After that, parallelize work packages that have no data or product dependency, but retain each package's own decision and security gates. Integration and migration work proceeds only after access, policy and feasibility approval. No deploy, live charge, outbound communication, provider selection or Mindbody cutover is implied.

## Work package register

| ID | Assignable outcome | Suggested lead | Estimate | Depends on | Decision gate |
|---|---|---|---|---|---|
| WP0 | Approvals, named approvers and a de-duplicated task map | Product owner / creator; finance, operations, security and legal approvers | 1–3 weeks elapsed, depending on decisions | None | D01–D17, priority and pilot boundary |
| WP1 | Reliable schedule, real data, navigation, member records and daily operations | Portal lead with backend engineer and operations tester | 3–6 weeks | WP0; reuse existing booking/check-in work | D06, D09, D11 |
| WP2 | Approved enrollment, billing, pauses, cancellation and reconciliation | Payments/backend lead with finance and legal reviewers | 4–8 weeks | WP0; payment comparison and portability reviews | D05, D08, D09, D12, D15 |
| WP3 | Reconciled owner finance and retention reporting | Data/analytics lead with finance approver | 4–7 weeks | WP0; WP2 financial event definitions | D07, D08, D11 |
| WP4 | Staff workflows, performance, ratings, leaderboards and rewards | Mobile/product lead with coaching operations and compliance | 4–8 weeks | WP0; WP1 attendance foundation | D03, D04, D09, D11, D13 |
| WP5 / #605 | Native CRM, communication delivery and enforced staff permissions | CRM/backend lead with security and communications operations | 6–12 weeks | WP0; permission contract and provider feasibility | D02, D09, D10 |
| WP6 | Live corporate dashboards, owner records and rankings | Portal/data lead with franchise operations | 5–9 weeks | WP0; WP3 metric and history contracts | D07–D09, D14 |
| WP7 | Drive, Trainual, marketing attribution, decline intervention and activity reporting | Integrations lead with security, marketing and HR/privacy | 6–12 weeks | WP0; WP5 contact ownership; WP6 owner/location model | D08, D09, D14, D16 |
| WP8 | Mindbody exit, history migration and coordinated pilot/cutover | Migration lead with operations, payments and QA | 4–8 weeks, plus pilot observation | WP0; relevant WP1–WP7 release evidence | D14–D17; completed data/payment portability decisions |

Effort ranges overlap when teams work in parallel. They should not be summed into a delivery date. WP0 is elapsed approval time; technical estimates assume staff availability, provider access and timely decisions.

## Assignment sheet

| Work package | Named accountable owner | Contributors | Approver | Status / target |
|---|---|---|---|---|
| WP0 — Approvals and task map | __________________ | __________________ | Creator / named policy owners | Not assigned |
| WP1 — Daily operations | __________________ | __________________ | Operations + security | Not assigned |
| WP2 — Billing lifecycle | __________________ | __________________ | Finance + legal + security | Not assigned |
| WP3 — Finance and retention | __________________ | __________________ | Finance + analytics | Not assigned |
| WP4 — Staff and rewards | __________________ | __________________ | Coaching ops + compliance | Not assigned |
| WP5 — Native CRM | __________________ | __________________ | Security + communications owner | Not assigned |
| WP6 — Corporate reporting | __________________ | __________________ | Franchise operations + finance | Not assigned |
| WP7 — Corporate integrations | __________________ | __________________ | Security + marketing/HR owners | Not assigned |
| WP8 — Migration and cutover | __________________ | __________________ | Creator + operations + payments | Not assigned |

## Requirements and source coverage

The approved specification remains the authoritative wording and evidence register. This table assigns every requirement section and all source ranges to a work package; it does not silently resolve open business decisions.

| Approved specification section | Work package |
|---|---|
| R01 Branding and navigation | WP1 |
| R02 Financial definitions and package reporting | WP3; WP6 for corporate roll-up |
| R03 Retention, churn and segmentation | WP3 |
| R04 Today checklist, reevaluations and agent | WP1 |
| R05 Member profiles and risk | WP1; WP3 for cohort/churn reporting |
| R06 Scheduling, check-in, resources and camps | WP1 |
| R07 Coaching, performance and staff mobile | WP4 |
| R08 Membership lifecycle and cancellation | WP2 |
| R09 CRM and staff permissions | WP5 |
| R10 Rewards and leaderboards | WP4 |
| R11 Corporate dashboards, rankings and owner journey | WP3 and WP6 |
| R12 Corporate integrations, intervention and engagement | WP5 for contact ownership; WP7 for integrations/analytics; WP6 for owner-facing intervention |
| R13 External follow-ups and migration | WP2 for payment-method feasibility; WP8 for Mindbody history and cutover |
| A1–A3, A7 | WP3 and WP6 |
| A4–A6, A8–A9 | WP6 and WP7 |
| A10 | WP1 |

**Website review items W01–W57:** W01, W06, W08, W10, W12, W27, W46, W56 → WP1; W02–W05, W39–W41 → WP3; W03–W04, W32, W44–W45, W47 → WP3 (W32 also WP4); W07, W13, W18 → WP1; W09, W11, W13–W15, W20, W23 → WP1; W21 → WP1/WP4/WP7; W24 → WP1/WP2; W30–W33 → WP1; W19, W21–W22, W32, W34–W38, W42–W43, W52–W55 → WP4; W24–W28, W48–W51, W57 → WP2; W16–W17, W26, W29, W34 → WP5. For any item assigned to more than one package, the packages own separate aspects (for example member display versus financial policy); WP0 records one accountable lead and prevents duplicate delivery.

**Meeting-only decisions and follow-ups:** confirmed native CRM direction → WP5; manual performance baseline → WP4; GM-phone payment comparison → WP2; reevaluation rule → WP1; capacity/camps/check-in behavior → WP1; staff mobile delivery decision → WP0, execution → WP4; Mindbody history and payment portability → WP8/WP2; HitTrax access, brand ordering, pilot date and remaining external dependencies → WP0, with any approved work routed to the relevant package.

## Work package details

### WP0 — Approvals and current-task reconciliation

Record D01–D17 as approved, rejected, or still open; assign a decision owner and evidence for each. Confirm MVP/pilot locations and date, what “fully leave Mindbody” means operationally, and which corporate/integration items are launch-critical. Compare every WP against the live task board; link, update, close or supersede overlapping proposed tasks instead of creating duplicate work. Identify prior/completed code as a foundation, not proof of runtime acceptance.

**Done when:** named approvers and an approved decision log exist; each requirement R01–R13 has a unique implementation home or an explicit deferral; existing tasks are mapped; pilot scope and go/no-go evidence are approved.

### WP1 — Reliable schedule, member navigation and daily operations

Fix authorized persisted Schedule booking creation and accurate success/error states; searchable linked-athlete selection; new-booking visibility in Check-In; actual-coach capture; agreed capacity and camp/event boundaries. Deliver Dashboard navigation, sticky/accessibility improvements, universal member links and truthful empty/error states. Add approved player details, balances, staff checklist and ten-day reevaluation tracking with shared completion history.

**Do not implement** unresolved reevaluation recurrence, role access, demographic privacy, credits/camp rules or capacity policy until WP0 approves the applicable decisions.

**Existing-work reconciliation:** `.local/tasks/schedule-booking-calendar-fixes.md` is a proposed UI task that explicitly excludes database persistence; `.local/tasks/portal-dashboard-schedule-ui-fixes.md`, `.local/tasks/checkin-and-roster.md`, `.local/tasks/v03-step-3-7-coach-selector.md`, `.local/tasks/member-detail-header-buttons.md`, and proposals #302/#479 may overlap. Resolve these in WP0 and absorb scope into one implementation route.

### WP2 — Enrollment, billing lifecycle and cancellation

Compare GM-phone payment alternatives without choosing a processor; implement only after explicit approval. Deliver approved enrollment, price/discount authority, deposits and future balances, billing dates, 30-/60-day holds and verified automatic resume, payment history and cancellation preview/interview/waiver policy. Include clear event reconciliation and failure/retry handling.

**Existing-work reconciliation:** proposals #256–#261 and #558–#561, `.local/tasks/billing-real-transactions.md`, `.local/tasks/declined-payment-recovery.md`, `.local/tasks/recurring-billing-date-change.md`, `.local/tasks/stripe-real-decline-test-cards.md`, and payment-comparison tasks #592/#593. Assign a single owner to reconcile; do not duplicate existing jobs or treat migration of customer records as payment credential portability.

### WP3 — Finance and retention data

Approve and implement the financial dictionary, collection categories, contractual MRR, remaining-autopay projection, package actuals, lifetime definitions, autopay rates, historical snapshots, monthly churn and segment policies. Add consistent drilldowns and transactions pagination. Make unknown or incomplete history explicit.

**Existing-work reconciliation:** `.local/tasks/billing-real-transactions.md`, `.local/tasks/owner-retention-real-cohorts.md` and `.local/tasks/portal-retention-churn-ui-design-alignment.md` overlap parts of reporting; `docs/payment-validation-report.md` is an evidence input, not an approved definition. Do not ship fixed LTV or placeholder comparisons as real calculations.

### WP4 — Staff tools, performance, ratings and rewards

Deliver the approved staff phone workflow, coach-private dated lesson notes, manual performance measurements with provenance, game stats, actual-coach ratings/reporting, complete leaderboards and durable compliant reward rules/catalog. Align to attendance from WP1 and permissions from WP0.

**Existing-work reconciliation:** `.local/tasks/live-coach-performance-metrics.md`, `.local/tasks/hittrax-capture-pipeline.md`, `.local/tasks/points-rewards-interactions.md`, `.local/tasks/profile-achievements-leaderboard-qr.md`, and related mobile tasks must be inspected. Manual entry is the baseline; HitTrax automation is not a launch prerequisite. Do not implement prohibited incentivized reviews or unapproved reward economics.

### WP5 — Native CRM and communication permissions

Build the native CRM foundation in the existing portal: adult/family contacts linked to the current athlete and membership records, prospects and approved pipeline stages, assigned follow-ups, a searchable activity history and (only if D10 permits it) an adult/guardian inbox. Avoid creating a second source of truth for families, athletes, memberships or existing threads.

The detailed agent-ready brief is `.local/tasks/leadership-wp5-native-crm.md`. It includes a preflight approval matrix, role-by-action and location controls, lead conversion, audit requirements, acceptance/security tests, exact existing-file references and explicit stop conditions. This can start with repository/schema and task reconciliation; write access, cross-location exposure and message sending must wait for D09/D10/D02 decisions.

**Existing-work reconciliation:** proposals #422/#475/#481 and `.local/tasks/admin-portal-messages-page.md` / `.local/tasks/fix-parent-coach-messaging-bugs.md` concern messaging and may conflict with the explicit removal of coach-to-player messaging. Resolve D10 before retaining or building any coach messaging path. Native CRM replaces GHL backend per the creator decision.

### WP6 — Corporate dashboards and franchisee journey

Deliver live scoped owner/corporate location metrics, dated rankings and drilldowns, owner profiles across locations, call notes/actions, historical monthly comparisons and approved revenue-decline interventions. Base every figure on WP3's metric and history definitions. Preserve tenant/location access boundaries.

**Existing-work reconciliation:** the merged owner/franchisor portal (`.local/tasks/owner-franchisor-portal.md`) is a screen foundation with demo data in sampled areas, not live network reporting. Inspect `.local/tasks/owner-portal-supabase.md` and all current portal tasks before separating deliverables.

### WP7 — Integrations, marketing and activity governance

Verify Drive and Trainual access/API/licensing before implementing sync or SSO. Build only the approved integration scope, with permission-safe file access, sync/error status and revocation. Implement marketing events and ad reporting only when sources/attribution are defensible. Add activity tracking only after transparency, retention, idle detection and role visibility are approved.

### WP8 — Mindbody exit, migration and pilot cutover

Inventory, map, import and reconcile approved membership, attendance, pause, billing and original-date history. Determine payment-method portability separately; never assume an exported family/member record includes a reusable card mandate. Rehearse rollback, cutover and post-cutover support, pilot location validation, old-system access retirement and the final authorization gate.

**Existing-work reconciliation:** `.local/tasks/mindbody-import-scripts.md` and proposals #253/#254 cover pieces of import/rollback. Task #593 is proposed for saved-payment-method portability. Coordinate with those rather than rewriting them; this package owns end-to-end reconciliation/cutover gaps only.

## Critical dependency and release gates

1. **Scope gate (WP0):** approved pilot, owners, decision log and task deduplication.
2. **Policy gates:** finance approves D08 and metric examples before WP2/WP3/WP6 figures; operations/security approve D06/D09/D11 before workflows and data grants; finance/legal approve D12 before charge/waiver behavior; compliance/finance approve D13 before rewards; D05/D15 before GM payments or card portability.
3. **Foundation gate:** persisted, authorized booking and shared attendance for coach, checklist and retention reporting; no work can treat screen appearance as acceptance.
4. **Integration gate:** provider/API access, country/device support, consent, data ownership, price and failure behavior verified before integration code.
5. **Pilot gate (WP8):** scenario-based acceptance across parent, GM, instructor, owner and corporate roles; financial reconciliation; data migration checksum/counts; permissions-denial evidence; payment/billing job evidence; support and rollback signoff.
6. **Launch gate:** named approver authorizes date, locations, communications, provider changes and production cutover separately.

## Program-wide acceptance and risks

- Each feature has user-observable acceptance criteria from R01–R13 and a named test owner.
- Direct endpoint/data access is tested for tenant and role isolation; hiding a menu item is not sufficient.
- Finance totals reconcile from underlying event details; duplicate webhook/job execution is tested; unavailable history is labeled.
- Parent/guardian/minor routing, communication consent, employee analytics privacy and reward platform rules are reviewed before relevant launch.
- Mobile compatibility, existing app identity, provider feasibility and rollout to installed app versions are planned.
- No commitments about New Year or another launch date until duration, pilot scope and unresolved policies are approved.

## Review requested

Review the work-package boundaries, suggested role leads, estimates and dependency gates. Fill the named-owner column only when you are ready to assign people. The proposed project tasks are intentionally not assigned; choose the person/team for each in the task panel before work starts.
