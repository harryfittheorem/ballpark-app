# Clubhouse / Infinite Hitting — leadership change specification

**Prepared:** November 18, 2026  
**Status:** Creator-approved scope baseline; decision gates retained. No implementation authorization.

**Decision record:** On November 18, 2026, the creator selected “Approve baseline; retain decision gates,” with no additional comments. This approves the consolidated scope, not unresolved business-rule answers, payment/provider selection or implementation.

## Executive summary

This document consolidates the meeting, 57 website review items and 10 updated requirements sections into one review baseline. Requested functionality is not assumed to exist because a prototype screen displays it.

Confirmed direction: Clubhouse without “The,” associated with Infinite Hitting; native CRM rather than GoHighLevel as backend; manual performance entry while API access is investigated; full departure from Mindbody; staff phone workflows; payment-method comparison before choosing GM-phone checkout. Brand ordering, distance metrics, staff-app packaging, payment approach and detailed financial/permission policies remain open.

**Recommended sequence:** establish trustworthy booking, billing and definitions first; daily operations next; reporting next; consumer expansion and corporate expansion after their dependencies. This is a proposal, not a schedule. CRM may move earlier if leadership makes it essential to the pilot.

**Approval boundary:** leadership may approve this as a scope baseline while explicitly retaining open decisions. That does not approve their proposed answers. Financial formulas, permission grants, billing transitions and external-service choices must receive separate explicit approval before affected implementation planning. No implementation tasks, provider selection, messages, account changes, live tests or deployment are authorized here.

## 1. Evidence, interpretation and status language

### Sources

| Key | Source |
|---|---|
| M | `attached_assets/Pasted-Infinite-X-Fit-Coaching-Summary-FITT-Coaching-and-Infin_1795044072862.txt` |
| W01–W57 | `attached_assets/Infinite_Hitting_Website_Review_Notes_1795044111059.docx`, November 13, 2026 |
| A1–A10 | `attached_assets/Infinite_Hitting_App_Requirements_Updated_1795044111059.docx`, November 13, 2026, including Implementation Notes |
| T | `attached_assets/Pasted-FITT-Coaching-About-the-agent-Awesome-So-the-first-thin_1795044820994.txt`; line references are transcript lines, not recording times |
| C | Creator decisions retained in the supplied review register: native CRM; manual performance input; payment alternatives comparison; leave Mindbody |

The uploaded transcript supplements the summary. No claim is made to have watched the recording. Earlier retrieval of the recap produced an application shell, not accessible meeting content. Speech-to-text ambiguities are not decisions. Dates on the written documents do not establish their sequence relative to the meeting.

Explicit creator decisions settle the matters they address only. Explicit meeting corrections supersede earlier discussion: the ten-day payment-linked reevaluation rule replaces the 30-day rule; camp enrollment does not mark attendance. Other conflicts remain open. A cancelled clarification form supplies no approval.

**Confirmed direction** means a recorded decision, not production acceptance. **Requested / policy open** means source-backed scope with details requiring approval. **Recommendation** is advice, not approved scope. **Optional** is exploratory. **Code foundation** means source behavior exists, not that live operations were accepted. **Defect / local-only** means confirmed source limitations. **Historical evidence** is a prior reported test, not a new test. **Unverified** does not mean nonexistent.

## 2. Decisions and unresolved policy register

Proposed approving functions below are responsibilities to assign, not named or authorized people. All open items remain blocking for their affected work; unrelated work is not implicitly approved.

| ID | Decision / proposed disposition | Status and approval required | Affected requirements |
|---|---|---|---|
| D01 | Clubhouse without “The,” with Infinite Hitting; choose “Clubhouse by Infinite Hitting” or “Infinite Hitting Clubhouse.” | Core name confirmed; ordering open. Leadership/brand approver needed. Current app config still says Ballpark; no identifier change presumed. | R01 |
| D02 | Native CRM, not GHL backend; retain linked conversations, calling, SMS and pipeline. | Confirmed C. Delivery providers, number ownership, email routing, legacy CRM export and required existing systems open. | R09, R12 |
| D03 | Manual dated average/peak exit velocity now; preserve provenance for later API input. | Confirmed C. Distance versus velocity-only remains unresolved (M/T versus W22/W52). No removal of historical data approved. | R07, R10 |
| D04 | Extend existing mobile app with separate staff navigation initially. | Recommendation only. Compare separate business app and mobile web; leadership approval depends on permissions, devices and payment SDK feasibility. Staff mobile need itself is confirmed. | R07, R08 |
| D05 | Compare Tap to Pay with hosted/tokenized card entry or payment link; start with secure checkout if feasible. | Comparison requested C; starting approach recommendation only. No processor selected or changed. | R08 |
| D06 | One reevaluation completion per player/billing-cycle obligation; surface from today's bookings and complete against actual visit. | Recommendation only. Approve cycle reset, inclusive 0–10-day window, overdue/no-next-charge treatment, multiple memberships, no-shows, cancellations and carry-forward rules. | R04 |
| D07 | Monthly churn uses starting cohort and losses in that same month; keep owner retention distinct from corporate removal of Average Retention. | Monthly basis confirmed; counted entity, pauses, transfers, nonrenewals, reactivation and cutoff open. Finance/operations approvers needed. | R02, R03, R11 |
| D08 | Approve metric dictionary, cash categories, refund/fee/tax/currency treatment and network eligibility. | Open. Do not use existing screen calculations as policy. | R02, R03, R11, R12 |
| D09 | Named Owner/GM/Instructor permissions with corporate oversight; no instructor sensitive billing. | Core direction confirmed; exact grants, note visibility, discount/refund/waiver authority and location boundaries open. | R05, R07–R09, R11–R12 |
| D10 | Remove coach-to-player messaging; decide whether authorized coach-to-parent CRM remains. | Written removal requested; guardian communication boundary unresolved. Existing messaging tasks are not approval to retain the removed channel. | R07, R09 |
| D11 | Actual coach at manual check-in; single-occurrence capacity exceptions; birthday divisions with school override. | Core requests confirmed. Multi-coach retention, manual versus availability-driven capacity, season cutoff and historic segment rules open. | R03, R06, R07 |
| D12 | Automatic 30-/60-day holds; contract-compliant cancellation preview and authorized exit-interview waiver. | Hold durations confirmed; custom holds, extensions, benefit treatment, resumption/failure behavior, proration and lawful final-charge rules open. Legal/finance/operations approval required. | R05, R08 |
| D13 | Reward removals/catalog and attendance-week direction retained; prohibited incentives excluded. | Points, cost model, streak length, achievement recurrence, verification and compliant social/review alternatives open. Compliance/finance approval required. | R10 |
| D14 | Pilot prioritizes local reliability/operations; corporate connectors later unless mandatory. | Recommendation only. Pilot locations, launch year/date, mandatory workflows and corporate release scope remain open; no date committed. | All |
| D15 | Leave Mindbody completely, including permanent operational dependency. | Confirmed C. Data availability, payment-method portability, cutover reconciliation and fallback/rollback plan unverified. | R13 |
| D16 | Drive library, Trainual and ad reporting are requested; no integration labeled live before verification. | Access, subscriptions, API feasibility, sync approach, source ownership, privacy/retention and attribution approval open. Link-only Drive is an alternative, not full-sync acceptance. | R12 |
| D17 | Review remaining franchisor feedback with Randall. | Confirm whether A document completes that follow-up; full transcript is already supplied, so do not request it again as missing evidence. | R11–R13 |

## 3. Consolidated requirements and observable acceptance

Acceptance outcomes below are requirements for later delivery, **not tests performed or approval obtained in this review**. Each R identifier also serves as the acceptance reference in the source tables.

### R01 — Branding, navigation and profile access
**Sources:** M, T83–123/T218–263; W01, W06, W08, W10, W12, W27, W46, W56. **Dependencies:** D01/D09.

- Add explicit Dashboard under Operations and retain Today and Members; Dashboard is the landing view. Resolve route/name behavior rather than merely relabeling Owner.
- Apply approved Clubhouse display branding; inspect current store/build identities before considering identifier changes.
- Sticky navigation, headers, tabs and member-grid controls must remain usable without covering content on narrow screens.
- All player references, including Billing, Cancellations and report drilldowns, open the correct authorized profile/payment/package history.
- Remove Coaches Today; add explanatory metric/category/action descriptions accessible through touch and keyboard as well as hover.
- Payments receives clear history, billing actions, legibility and Infinite Hitting branding. Empty live data must not masquerade as successful demo activity.

**Acceptance:** a user can navigate directly to Dashboard and back to Today; scroll and keyboard/touch access remain usable; representative names in every named context reach the same player; empty/error states are honest.

### R02 — Finance and package reporting
**Sources:** M, T343–418/T993–1078; W02–W05, W39–W41; A1–A3/A7 and Implementation Notes. **Dependencies:** D07/D08/D12.

- Distinguish contractual MRR, collected autopay, new money, total collected, remaining scheduled autopay and month-end expected collections. Projection adds actual collected to eligible remaining autopay and excludes speculative sales.
- Define every amount's period/as-of/timezone, gross/net basis, discounts, deposits, refunds, disputes, tax, platform/processor fees and currency. Separate USD/CAD unless an explicit conversion policy exists.
- Package reports show actual paid revenue, active count, average paid per client, revenue share and separately labeled estimated LTV; show actual sold price and optionally list price.
- Distinguish realized lifetime collections, estimated LTV and average lifespan, including treatment of active members and missing history.
- Give different names to autopay enrollment share and scheduled-payment collection success. Paginate transactions using 10/20/50 rows.

**Acceptance:** finance can reproduce each card from its transaction/member drilldown; a deposit and its balance appear once each; retry attempts do not inflate obligations; refunds and mixed currencies follow the approved dictionary; no fabricated historic MRR.

### R03 — Retention, churn and historical segments
**Sources:** M, T553–638; W03/W04/W32/W44/W45/W47; A1–A3/A7. **Dependencies:** D07/D08/D11.

- Monthly starting-cohort losses replace weekly fluctuations; last-completed-month figures carry an explicit label and lost-player names/effective cancellation or nonrenewal dates.
- Corporate retains Nationwide/Network Churn and LTV, removing separate Average Retention. Owner retention is not removed by that corporate request.
- One churn page supports combined age/sport/gender/Rec–Travel–Both filters; remove separate Churn by Age navigation, not the age dimension.
- Tenure bands: 0–30, 31–90, 91–180, 181–270, 271–360 days; later three-month intervals need approved non-overlapping calendar/day boundaries.
- Divisions: 8U, 10U, 12U, 14U, High School, College. Birthday-derived rules, season cutoff, manual school overrides and historical segment membership require explicit policy.
- Month/quarter/year/custom controls, location/network benchmarks, trends, retention/tenure/cancellation and instructor dimensions use consistent cohorts.

**Acceptance:** cohort counts reconcile between cards, filters and lost-member records; a birthday/override does not rewrite prior segment results; zero denominator/missing history displays unavailable, not invented 100%.

### R04 — Today checklist, reevaluation and embedded agent
**Sources:** M, T1083–1128/T1653–1723; W07/W13/W18; A10. **Dependencies:** D06/D09; durable attendance and billing dates.

- Persist tasks, assignee, due context, status and completion audit. Include confirmations, milestones, new faces, renewals and revenue-generating actions; define carry-forward.
- For a player coming in today whose next charge is within ten days, show a reevaluation task for that visit. Repeat on subsequent visits until valid completion. The prior 30-day-since-reevaluation rule is superseded.
- Recommended visibility begins from today's bookings, not only after check-in; actual attendance/completion, no-show/cancellation handling and billing-cycle reset require D06. Do not silently choose a rule.
- Player Re-Evaluation tab shows completed count, dates, results, coach notes, outcome comparisons, latest completion and next scheduled date when available. Authorized coaches/GMs/corporate can review under the approved matrix.
- Manual completion and authorized agent assistance share the same persisted history. Embedded agent is requested; Slack/text interfaces are optional. Financial/outbound actions require permission, explicit approval and duplicate prevention.

**Acceptance:** under the approved D06 scenarios, an eligible booking appears during daily planning, completion survives refresh and another device, an incomplete visit prompts again appropriately, and valid completion suppresses same-cycle repeats without suppressing the next eligible cycle. Agent cannot exceed actor permissions.

### R05 — Member profiles, balances and follow-up evidence
**Sources:** M; W09/W11/W13–W15/W20/W21/W23/W24/W45. **Dependencies:** D06/D09/D11/D12.

- Collect player birthday, Baseball/Softball/Both, Rec/Travel/Both and original membership start. Support birthday/anniversary reminders and recognition history. Gender optionality and privacy need approval.
- Show remaining sessions in rows and profiles, particularly while paused. Define use, no-show deductions, expiry, rollover and hold rules.
- Manual Reviews Asked/Left and Referrals Asked/Given are separate auditable states with dates/staff/history; unknown is distinct from false.
- Following an in-person referral request, send an authorized consent-compliant shareable link and retain outreach. Free-session offer terms are not approved.
- Explain each risk/follow-up flag: 14-day absence, pause, payment issue, required overdue reevaluation, review follow-up and approved app inactivity. No unsupported claim of predictive churn accuracy.
- Canceled members remain separately filterable. Engagement scoring inputs/weights remain unapproved.

**Acceptance:** profile/row balances agree with the credit ledger; staff can identify evidence behind each flag and distinguish asked, fulfilled, not asked and unknown; manual changes are attributable.

### R06 — Scheduling, actual-coach check-in and camps
**Sources:** M, T803–838/T2423–2438/T2488–2618; W30–W33. **Dependencies:** D09/D11/D12.

- Highest-priority defect: replace local-only Schedule success with durable authorized creation, database-linked athlete selection, loading/error handling, capacity/resource conflict protection and synchronization.
- Search existing athletes rather than saving a free-text name. Standard bookings are Hitting Lesson and Cage Rental; camps/clinics remain event offerings. Resolve evaluation/appointment categorization rather than globally deleting other event types.
- Customers book Infinite Hitting, not an instructor. GM or instructor selects actual coach at manual check-in, with auditable corrections and reporting attribution.
- Location-specific instruction/rental cages, walk-ins, recurring schedules and single-occurrence capacity overrides. Manual versus availability-derived capacity is open.
- Camp purchase enrolls the full defined multi-day roster once, within capacity; attendance remains daily manual check-in. Refund, cancellation, partial attendance and capacity-failure handling require policy.

**Acceptance:** a booking survives refresh and is retrievable in Check-In on another device; a new insert reaches the roster, not only status updates to existing rows; simultaneous attempts cannot exceed approved capacity; changing one occurrence leaves its series unchanged; one camp purchase creates correct roster entries but no attendance.

### R07 — Coaching, manual performance and staff phone workflows
**Sources:** M, T1733–1918; W19/W21/W22/W32/W34–W38/W42/W43. **Dependencies:** D03/D04/D09–D11.

- Structured dated measurements retain average/peak exit velocity, units, athlete, recorder, location/session association where known and source provenance. Roster entry is preferred. API input later must not overwrite historical manual measurements silently. Remove launch-angle presentation; distance scope remains open.
- Private lesson notes have dates and lesson numbers, usable on a phone; parent/player access denied by default pending policy, GM/corporate access explicitly decided. Notes must be protected below the UI.
- Self-reported game stats include date, at-bats, hits/types, strikeouts, walks, RBIs and notes, visible to instructors and labeled separately from training measurements.
- Rename Hire Coach to Add Coach; new locations use Hitting Instructor instead of Specialty Coach. Existing specialty record treatment remains open.
- Remove coach-to-player messaging; adult CRM scope awaits D10.
- Capture actual instructor on every lesson; request 1–5 rating after each class with optional comment. Show average rating, rated-session share and approved retention attribution.
- Sessions Done opens date/actual coach/type/rating; Coaches Hours includes average rating and original hire date/first anniversary; No-Shows and Cancelled open player/date/time/coach records; remove Confirmed.
- Staff phones support checklist, roster measurements, private notes and authorized GM enrollment. Recommended existing-app role-based delivery preserves consumer screens; separate business app/mobile web remain alternatives.

**Acceptance:** saved notes/measurements remain available after device changes; unauthorized direct requests cannot read private notes; averages/coverage reconcile to actual lessons/ratings; required staff actions complete on agreed devices without desktop-only steps.

### R08 — Enrollment, billing lifecycle, pause and cancellation
**Sources:** M, T1993–2048/T2243–2273; W24–W28/W48–W51/W57. **Dependencies:** D05/D08/D09/D12; contractual/legal review.

- Consumer creates an account; authorized GM selects it on a phone and can negotiate price, apply approved discounts, choose start/charge dates, collect deposit and schedule balance/recurrence.
- Preview amounts, dates, status, reason and permission consequences for enrollment, billing-date changes, holds and cancellations. Never double-charge deposit/balance/first recurring period.
- 30-/60-day automatic holds require resume execution plus payment/state reconciliation, not just a migration file or date display. Confirm extensions, custom lengths, entitlement rules and failed-resume handling.
- Pause reporting includes time to first pause, pause-to-cancel, pause-to-cancel duration, reactivation and successful billing resumption, average duration and unused credits by location/date. Missing imported history stays unknown.
- Exit reasons only Schedule, Price, Distance, Competitor, Quit Sport, Other. Other has optional details; Competitor allows search/add/reporting.
- Low Balance Packs: Today/7/30/90/custom ranges plus player/balance/pack/last session; approve which date is filtered and low threshold. Expiry and low balance remain distinguishable, optionally in one filtered attention list.
- Cancellation shows applicable notice period, expected final amount/date, interview request, GM notification, interview outcome and authorized waiver. Written 30-day notice/waiver request is subject to actual contracts and US/Canadian law; it is not a blanket billing rule.

**Acceptance:** preview and actual ledger/schedule match approved scenarios; failed charges never appear paid; retry/webhook replay causes no duplicate charge or ledger entry; pause resume and cancellation complete through scheduled execution; a request/interview alone never silently waives or charges money.

### R09 — Native CRM and enforceable permissions
**Sources:** M, C; W16/W17/W26/W29/W34. **Dependencies:** D02/D09/D10/D16.

- Native leads, opportunities/pipeline, follow-ups, inbox, linked conversation history, SMS viewing/sending/replying, calling and evaluation/appointment/lesson calendar. Add Text to cancellation contact alongside Call/Email.
- Native CRM is the intended product record; define imported legacy history, contact deduplication, location ownership, provider identifiers and inbound/outbound delivery/sync ownership.
- Owner, GM and Instructor have individual logins, configurable access and corporate oversight. Map existing owner/admin/coach/super_admin roles and staff/instructor presets explicitly; do not rename all admins GMs automatically.
- Instructors cannot access sensitive billing; contact data, private notes, discount/refund/waiver authority, cancellations, outbound messaging and cross-location access require granular approval and API/database enforcement.
- Consent, opt-outs, guardian routing for minors, delivery/error states, communication audits and send idempotency are mandatory. Agent uses actor authority, never elevated blanket access.

**Acceptance:** an authorized reply appears in one linked history; opted-out/unauthorized destinations are blocked; restricted direct requests fail regardless of menu visibility; provider failures remain visible instead of false “sent.”

### R10 — Rankings and compliant, costed rewards
**Sources:** W52–W55; M/C performance scope. **Dependencies:** D03/D09/D11/D13.

- All eligible players are reachable in pageable/scrollable rankings, not just top 10/20/50; use agreed sport/age divisions. Velocity/distance/API requests are subject to D03; manual is baseline, automatic feeds not a prerequisite.
- Remove Coach Reviews Homework and Drill Homework earning activities. Requested additions include game stats, tenure, ranking top-10/top-3/#1 achievements and social/review activities.
- W54 social list: local/corporate Instagram and Facebook follows, corporate YouTube subscription; review list: Google, Facebook, in-app and Yelp. These are requests for compliance review, not permission to ship prohibited incentives.
- Do not implement incentivized Google/Yelp reviews or prohibited review/engagement incentives; check current platform rules before selecting alternatives and never condition rewards on positive ratings.
- Replace daily seven-day login streak with at least one attended visit per Monday–Sunday calendar week; approve consecutive-week target, timezone, holds/closures and no-show rules.
- Prevent repeated awards for one-time actions or ranking re-entry; approve verification and reversal rules.
- Catalog only T-shirt, water bottle, bat sticker, PS5, local MLB tickets and baseball bat. Approve points, costs, stock/fulfillment, normal-attendance/max-engagement redemption timing and franchise liability.

**Acceptance:** rules persist beyond refresh, awards/redemptions are auditable and idempotent, all eligible ranks are accessible, privacy/consent rules apply, and finance/compliance approve the economic model before launch.

### R11 — Corporate dashboards, location rankings and owner journey
**Sources:** A1–A3/A7. **Dependencies:** D07–D09/D11/D14.

- Location tracker on owner dashboard with authorized locations; corporate network counterpart: Leads, Evals Booked/Completed, Closing Rate, New Members, New Money, MRR, MTD Sales.
- Date/history filters, sorting by any KPI, meaningful totals and location comparisons. Network average MRR uses only qualifying open locations in the selected period, with opening/closure dates and partial-month policy.
- Every ranking opens full dated/history-enabled location rankings and benchmarks: Sales, MRR, Closing Rate, New Members, LTV, Lifespan, Checklist Completion, Instructor/GM/Franchisee Call Attendance and Google Reviews. Define counts/denominators and tie rules.
- One owner profile supports multiple locations, contacts, signing/opening dates and milestones; searchable chronological departmental call notes and assigned actions/deadlines/responsibility/overdue follow-up.
- Each month since opening compares location metrics with same-calendar-month network averages, absolute/percentage variance and trends; missing months unavailable. Same-operating-age benchmarking is optional.
- Corporate Retention provides Nationwide Churn/LTV, location/network switching, drilldowns, benchmarks/trends and month/quarter/year/custom controls; do not restore Average Retention.

**Acceptance:** totals and ranked lists use the same eligible records/time basis; owners cannot access unauthorized locations; unavailable historical months are not reconstructed from current MRR; zero benchmark makes percentage variance unavailable.

### R12 — Corporate connectors, marketing, interventions and activity
**Sources:** A4–A6/A8/A9. **Dependencies:** D02/D08/D09/D14/D16.

- Owner Drive library: agreements, onboarding, training, marketing, sales, operations, financials and notes; association, categories/search, version history and new-file sync. Choose full integration versus phased links explicitly. Portal and external access must both satisfy the approved access policy; no public-link bypass.
- Two consecutive completed month-over-month revenue declines require three comparable observations. Notify owner and leadership, include corporate booking link, log journey, track booking/completion and unbooked reminders. Approve revenue basis, thresholds, exclusions, timezone, short history and cooldown.
- Marketing navigation for corporate/owners; corporate-managed events/campaigns, meetings/training/deadlines, RSVP where appropriate and resources. Authorized location ad metrics/date/history; corporate network comparisons.
- Spend, Leads, CPL, Evals Booked, Cost/Evaluation, attributed New Members, CAC and ROAS require defensible identity matching, source data and attribution window/model. Unknown remains unknown.
- Training tab accesses Trainual onboarding/SOPs/courses/playbooks; role-scoped progress/completion for owners/GMs/instructors and corporate oversight. SSO/seamless launch is exploratory until subscription/API support verified.
- Activity: last active, login frequency, active days, active time/session duration, feature/page usage and Trainual activity; role/person/location/date filters, trends/rankings and 7/14/30-day inactivity flags. Idle/background rules, transparency, retention and employee/minor visibility approved before collection. Composite score optional.

**Acceptance:** connector disconnected/stale/error states are explicit; permission revocation affects access; intervention fires once per approved episode and its outcome is tracked; no attribution or activity is invented when unavailable.

### R13 — Migration, launch gates and external ownership
**Sources:** M/C, T2718–2843. **Dependencies:** D14–D17.

- Exit Mindbody rather than retain a permanent integration. Inventory original membership/hire/opening dates, attendance, pauses and billing history; establish source-quality/reconciliation rules. Records import is not payment-token migration.
- Payment portability, lawful mandates and provider transfer feasibility require separate approval and verified access. No provider/account action is authorized now.
- Randall owns statistics-only/daily HitTrax affordability follow-up and remaining franchisor feedback. API access is not required for manual performance baseline.
- Broken external Nike merchandise link remains Infinite Hitting/vendor ownership; TJ informs Anthony. No automatic project-store responsibility.
- Leadership must define pilot locations, mandatory journeys, launch date/year and go/no-go approvers. New-year aspiration is not a deadline.

**Acceptance:** approved migration counts/amounts reconcile, unknown source history stays labeled, payment authority survives only through verified approved transfer or new consent, and no launch proceeds on screen presence alone.

## 4. Metrics dictionary — for explicit approval

Common contract: location-local calendar period `[start, next-period-start)`, explicit timezone and as-of timestamp, immutable event references, selected location scope and separate currencies. These conventions are **proposed**, not approved. Finance must settle cash versus recognized revenue, settlement versus success time, refunds/disputes/tax/fees and allocation across packages/locations. Counts use stable identities, not displayed names. Unknown/zero-denominator results are unavailable.

| Metric | Proposed definition / decision boundary | Evidence needed for acceptance |
|---|---|---|
| Contractual MRR | Sum approved normalized monthly recurring obligations effective at as-of; exclude one-time packs/deposits. Pause/discount/tax treatment and nonmonthly normalization require approval. | Effective contract and recurrence records; not current balance extrapolated into history. |
| Autopay collected | Successful cash events classified recurring autopay in period; exact first-recurring-payment category unresolved. | Unique charge/ledger references with refunds according to approved basis. |
| New money collected | Successful collections in mutually exclusive approved non-autopay categories. Decide deposits, first payments, packs, retail and other receipts. | Explicit category per transaction; no overlap with autopay. |
| Total collected | Autopay + new money only if categories exhaust scope; otherwise show explicit Other reconciliation. | Detail sum equals headline on same basis/currency. |
| Remaining autopay | Unique eligible unpaid recurring obligations scheduled after as-of through month end. Do not sum retries as new obligations. Overdue/paused/canceled/deferred eligibility open. | Future schedule and exclusions visible per obligation. |
| Month-end projection | Total collected MTD + remaining eligible scheduled autopay. **Confirmed meeting relationship; no forecast new sales.** | Example: 8,000 autopay + 2,000 new money + 5,000 remaining = 15,000, not 17,000. Eligibility/basis still need approval. |
| MTD Sales / Revenue | Must be separately approved as cash collections, signed sales or recognized revenue; do not silently equate them. | Source ledger/contracts and policy label. |
| Package revenue / average paid | Actual allocated collections / unique paying clients for same package/period; payer identity and refund treatment open. Active count reported separately. | Actual sold price, list price if retained, allocation and unique-client detail. |
| Revenue share | Package collections / comparable total collections ×100; allocation must exhaust or explain residual. | Reconciled numerator/denominator. |
| Realized lifetime collections | Successful historical collections for defined customer identity, adjusted under approved refund policy. | Historical completeness and constituent events; not face-value packs. |
| Estimated LTV / lifespan | Method not approved. A candidate is monthly revenue per customer × estimated lifetime months; active tenures are censored, not completed lives. | Approved estimation/cohort method, observation period and missing-data handling. Fixed $280 multiplier unacceptable. |
| Monthly churn | Distinct starting-cohort entities lost during same month / starting cohort ×100. Entity and loss/reactivation policy open; within-month new-and-lost reported separately under this proposal. | Starting cohort and dated losses; 100 start, 10 qualifying losses →10%. |
| Monthly retention | 100% minus churn only for identical approved cohort/loss definition; example above →90%. | Same cohort, not active/noncancelled ratio. |
| Autopay enrollment / collection success | Enrollment: enabled eligible entities / eligible entities. Success: collected obligations / due obligations (count or dollars explicitly named). | Retries deduplicated; no unlabelled mixing of amount and count rates. |
| Leads / Evals / closing rate | Deduplicated leads; booked evaluations distinct from completed attendance; proposed closing = attributed conversions / eligible completed evaluations. Windows and attribution open. | Linked lead/evaluation/member records; not unrelated same-month counts. |
| New members | New entities under approved player/membership/family and reactivation rules during period. | Original start/event provenance and deduplication. |
| Network average MRR | Sum eligible location MRR / eligible open locations at selected date/period. | Historical opening/closure/partial-month eligibility; pooled currencies prohibited without policy. |
| Benchmark variance / MoM | Absolute = location − benchmark; percentage = difference / benchmark ×100. MoM compares equivalent completed periods. | Zero baseline unavailable; currency/eligibility consistent. |
| Rating / rated share | Mean accepted 1–5 ratings; rated lessons / eligible completed lessons ×100. Multi-coach attribution unresolved. | Actual coach, lesson and unique rating; 3 rated of 4 eligible =75%. |
| Coach retention | Model unapproved; candidate lesson-share weighting requires approved lookback, minimum sample and lost-player allocation. | Same player not counted as a full loss for every instructor without disclosure. |
| Pause analytics | First-pause tenure: start to first pause among known first pauses. Pause-to-cancel: observed qualifying pauses followed by cancellation / eligible observed pauses. Resume success: actual successful post-hold charge / eligible holds due to resume. Define follow-up horizon. | Separate state reactivation from collected payment; ongoing holds/unknown history not counted as failures. Duration distinguishes completed from active pauses. |
| Checklist / call attendance / reviews | Completed eligible tasks / due tasks; attended calls / invited eligible calls, separated by role; reviews show counts and an explicitly approved rate denominator if used. | Auditable completion/attendance/source and due-date cutoff; not screen views. |
| CPL / cost per eval / CAC / ROAS | Spend / attributed leads; spend / attributed evals (booked vs completed named); spend / attributed acquired customers; attributed revenue / spend. | Approved attribution window/model, currency, refunds and cost scope; zero/missing denominator unavailable. |
| Activity / inactivity | Last qualifying foreground event, active-day count, approved active-time/session rules; 7/14/30-day elapsed flags. | Idle/background and timezone rules; sign-in metadata alone cannot establish feature usage or time in app. |
| Reward liability / redemption timing | Expected outstanding redeemable cost and earned points per approved normal/max activity scenarios, with stock/fulfillment/cost assumptions. | Finance-approved point economics; no arbitrary costs/rates. |

## 5. Proposed permission matrix — NOT a grant of access

Legend: **Scoped** = authorized records/locations only; **Decide** = explicit approval needed; **No** = required exclusion or conservative proposed default. Corporate oversight does not mean unrestricted access to every sensitive field. Parent/player access must be guardian-linked; minors' communication and public ranking exposure require consent policy.

| Capability | Corporate | Owner | GM | Instructor | Parent/player |
|---|---|---|---|---|---|
| Network operational reporting | Scoped network | Own locations only | Assigned location only | Approved aggregates only | No |
| Member operational profile/checklist | Scoped | Scoped | Scoped | Assigned/approved roster | Own permitted profile only |
| Sensitive billing/payment history | Decide fields | Scoped, approved | Decide fields | **No** | Own permitted account only |
| Discounts, deposits, future balances, billing dates | Decide authority | Decide limits | Decide limits | **No** | Approved self-service only |
| Refunds, holds, cancel, notice/final-charge waivers | Decide authority | Decide limits | Decide limits | **No** | Request; no staff waiver powers |
| Private lesson notes | Decide | Decide | Decide | Authorized coach scope | **No** pending policy |
| Reevaluation history | Authorized | Decide | Authorized | Authorized | Decide shared results, not automatic private notes |
| Performance/game stats | Scoped | Scoped | Scoped | Scoped | Own approved measurements/self-reported stats |
| SMS/calls/email and contact details | Decide | Decide | Decide | Decide adult CRM; no player messaging | Own guardian-linked conversations |
| Rewards/rules and fulfillment | Decide | Decide | Decide | Decide | Eligible earning/redemption only |
| Drive/Trainual/owner journey | Scoped | Own approved records | Decide | Training/approved documents | No |
| Employee activity analytics | Decide | Decide | Decide | Own visibility if approved | No employee analytics |

All grant decisions must specify read/create/edit/delete/export scope, location boundaries and audit requirements. Enforce at endpoint/database/storage layers, not only navigation. Record actor, role, location, target, before/after state, reason and approval for sensitive changes; secure notes/messages remain governed data, not unrestricted log content. Agent actions inherit all limits and confirmation requirements.

## 6. GM-phone payment alternatives — no provider chosen

This is a requirements comparison, not a current provider capability/pricing claim. No account connection, provider research contact or live test was performed. Quotations, official support checks and security review remain dependencies.

| Decision axis | Native Tap to Pay / supported reader | Secure hosted/tokenized card entry or payment link |
|---|---|---|
| Experience | Contactless card/device presented to compatible GM hardware; reader is a separate hardware option, not identical to phone Tap to Pay. | GM-assisted tokenized entry or customer completes secure checkout/link. A browser form is not native card-present Tap to Pay. |
| US / Canada | Verify processor/platform/location-country, merchant eligibility and regional SDK support. | Verify processor-country/connected-account support and local authentication requirements. |
| Devices/distribution | Verify supported iOS/Android versions/devices, entitlements, app review, reader fallback and managed-device needs. | Confirm mobile browser/webview/native SDK compatibility and accessible customer flow. |
| Pricing | Obtain card-present/contactless rates, hardware/SDK/platform/Connect fees, refunds/disputes and currency conversion. | Obtain card-not-present/online, saved-card/off-session and platform fees. No assumed savings. |
| Future recurring billing | **A tap does not automatically provide reusable recurring credentials.** Verify reusable token flow, customer authorization and connected-account scope. | Verify setup/saved-card authorization, authentication and future off-session mandate; a one-time link alone does not establish recurrence. |
| Deposits/balance/recurrence | Distinguish immediate card-present charge, later balance and first recurring invoice; prevent double collection. | Same financial obligations and idempotency; one checkout success must not imply every future obligation is paid. |
| Refunds/receipts/consent | Approve refund permissions, receipts, financial disclosures and recurring consent. | Same requirements; securely route link to correct adult and avoid duplicate links/charges. |
| PCI/security | Use approved SDK/tokenization; verify actual compliance obligations and device policy. No raw card storage/logging. | Prefer processor-hosted/tokenized fields; validate actual integration-specific PCI scope. Do not assume “hosted” removes all merchant obligations. |
| Connectivity/fallback | Verify supported online/offline behavior; do not promise offline collection. Approved reader/link fallback may be needed. | Requires connectivity/customer delivery; show pending/error state. No insecure manual card capture as fallback. |
| Delivery effort | Additional native SDK/hardware/entitlement/device testing and operational support likely; quantify after feasibility. | Potentially lower initial device/distribution complexity; still requires saved-card, billing lifecycle and role work. |

**Recommendation, not approved reduction:** begin with secure processor-hosted/tokenized checkout plus explicit saved-card authorization if supported, then add Tap to Pay when country/device/processor economics and staff needs justify it. Compare all alternatives before selecting. Existing Stripe code is a foundation, not a decision to retain or replace Stripe.

## 7. Current foundations, defects and evidence limits

Read-only source assessment, November 18, 2026. No new runtime/browser/payment/database acceptance was run. The path in the original register for Today was stale; current file is under `owner/dashboard`.

| Area and evidence | Classification / verified source behavior | Not established / later acceptance needed |
|---|---|---|
| `portal/app/owner/schedule/ScheduleContent.tsx`, `handleNewBooking` | **Confirmed local-only defect:** creates `local-` ID, appends React state, shows success; no create request. Empty bookings initialize demo records. | Durable booking, athlete ID, capacity enforcement and Check-In visibility. Existing read/cage-write capability does not fix create. |
| `portal/app/owner/schedule/actions.ts`, `assignCageAction` | **Confirmed authorization gap in reviewed action:** service-client update filters by booking ID; creates user client but shows no user/role/tenant check before update. Fetch also permits tenant environment fallback and converts query errors to empty results. | Exploitability not tested. Explicit authorization/error handling is a reliability gate; do not claim RLS protects a bypassing service-client write. No fix made. |
| `portal/app/admin/check-in/CheckInBoard.tsx` | **Code foundation:** check-in/no-show/undo server-action calls, state and realtime updates. No actual-coach selector in reviewed flow. New realtime row not in current list is ignored (`idx === -1`). | New bookings becoming visible without reload, full realtime insert/delete behavior, coach attribution and live RPC permissions require acceptance. |
| `src/hooks/useStaffSessions.ts` | **Code foundation:** mobile today queries, RPC mutations and cache invalidation/realtime patching; waits for instructor identity before coach query. | Full staff phone enrollment/checklist/notes or final permission matrix not established; new-row sync needs verification. |
| `portal/app/owner/dashboard/TodayDashboardContent.tsx` | **Code foundation / missing request:** data-backed schedule/KPIs, Coaches On Today remains; reviewed component is not a persisted daily checklist. | R04 actionable shared completion and real revenue definition. |
| `portal/lib/supabase/ownerQueries.ts`, `getOwnerKPIs` | **Confirmed formula mismatch:** MRR sums active amounts without establishing recurrence normalization; retention is active/noncancelled, not monthly starting cohort; autopay success uses paid/(paid+failed) amounts; risk uses >21 days, helper uses >14/>21. | Approved metrics, obligation-level retry dedupe, coherent risk policy and source completeness. |
| `portal/lib/supabase/hqQueries.ts` | **Code foundation:** location/network queries, family-primary-location attribution and omission of unattributed multi-location families to avoid duplication. Current MRR summed from active amounts; last-sign-in metadata available. | Historical open-location eligibility/MRR snapshots, full location permission acceptance or requested time/feature telemetry. |
| `portal/app/owner/retention/RetentionContent.tsx` | **Mock/formula limitation:** labeled sample-data fallback exists; LTV multiplies lifetime months by fixed $280; comparison deltas hardcoded. | Approved financial model and historical comparisons, even with live cohorts. Sample labeling is not live acceptance. |
| `portal/app/owner/franchisor/page.tsx` | **Mock experience:** hardcoded location metrics and rankings in reviewed screen. | Complete corporate tracker/owner journey/rankings with real eligibility/history. This does not mean every HQ query is fake. |
| `portal/app/owner/points-rewards/PointsRewardsContent.tsx`, rule handlers | **Local-only experience:** rule edits operate on component state. | Durable policy/ledger/award behavior. Do not generalize this to every reward redemption or product operation. |
| `portal/lib/auth.ts` | **Code foundation:** owner/admin/coach/parent/super_admin claims; instructor/staff presets. | Approved GM mapping, configurable access and endpoint-by-endpoint enforcement; role presence alone proves neither. |
| Pause/cancel migrations and edge-function foundations | **Code foundation:** pause/resume/cancel functions and cron-registration/rewiring migrations exist. | Present scheduled-job registration/execution in target environment and new 30-/60-day/waiver rules remain unverified. |
| `docs/payment-validation-report.md` and payment task history | **Historical evidence:** report last-updated July 10, 2026 describes Stripe Connect test-mode validation for one-time/split/scheduled/recurring payments, retries/webhooks and period-end cancellation; reports fixes for initial ledger omission and invoice compatibility. | Not a new live test, not card-present approval, not proof of current cron operation, legal 30-day notice behavior or acceptance of new reporting definitions. Its “production-ready” conclusion is limited to its own tested scope/environment. |
| GHL/Drive/Trainual, reevaluation subsystem, camp purchase-to-roster, requested telemetry | **Unverified in reviewed areas.** Native CRM is the newly confirmed direction, so a missing GHL connector is not itself a future requirement. | Full repo/runtime inventory and approved implementation acceptance later; absence from sampled files is not proof no partial component exists elsewhere. |

### Existing-work reconciliation — before any implementation task creation

Task references below are identifiers from the supplied task list, not verified completion states. Proposed tasks do not establish code behavior.

- Pause/resume scheduling, visibility and notifications already have proposals: 256–258. Cancellation scheduling/detail/notifications: 259–261. Compare against cron rewiring and historical payment evidence before declaring missing or duplicating.
- Billing real transactions and monthly reporting: 272–273; card backfill 274. Financial definitions must precede acceptance of their reporting outputs.
- Mindbody import exercise/rollback: 253–254. Keep these distinct from payment-method migration and full exit planning.
- Coach reporting/day drilldown 271; upcoming sessions 479; parent thread replies/read/delivery 422/475/481. D10 may change messaging scope; do not start/retain conflicting work by implication.
- Balance-charge scheduling/member visibility/staff reporting: 558/559/561. Existing payment foundation is not completion of every staff workflow.
- Branding regression proposal 587 and `app.json` still naming Ballpark require inspection, not a second automatic rebrand task.
- `.local/tasks/booking-flow-overhaul.md` already describes consumer booking without public coach selection; it does not establish persistent owner Schedule creation.
- `.local/tasks/member-detail-header-buttons.md` already covers real member-profile booking/edit/message actions; reconcile rather than create duplicate profile booking work.
- The supplied project list is partial. A later authorized planning pass must inspect the then-current full task board, map each requirement to existing/completed/proposed work, update conflicting scope and create only genuine gaps. No task is accepted or started by this specification.

## 8. Complete website source traceability — 57 items

Every row maps a source request to its requirement/acceptance outcome and records policy exceptions. “Retained” means in review scope, not approved for implementation.

| Source | Request | Requirement / disposition |
|---|---|---|
| W01 | Rename Owner to Dashboard | R01; explicit Dashboard destination, retain Today. |
| W02 | MRR reporting period | R02; dictionary/D08 approval. |
| W03 | Retention definition/source/period | R02/R03; D07/D08. |
| W04 | Lost names and dates | R03; member drilldown. |
| W05 | LTV collections vs pack value | R02; actual versus estimated separated. |
| W06 | Billing player links | R01/R02. |
| W07 | Actionable Today checklist | R04. |
| W08 | Remove Coaches Today | R01. |
| W09 | Engagement definition | R05; scoring not approved. |
| W10 | Sticky Members grid/menu | R01. |
| W11 | Explain At Risk | R05. |
| W12 | Tooltips | R01/R02; accessible equivalents. |
| W13 | Risk triggers incl. 30-day reevaluation | R04/R05; **30-day trigger superseded**, others need coherent policy. |
| W14 | Reviews Asked/Left | R05; manual, auditable. |
| W15 | Referrals Asked/Given | R05. |
| W16 | SMS tab/send | R09; native CRM, consent. |
| W17 | Owner/GM/Instructor permissions | R09; matrix approval. |
| W18 | Ten-day pre-charge reevaluation | R04; attendance/visit-linked clarification, D06. |
| W19 | Remove launch angle | R07; presentation, not historical deletion. |
| W20 | Original-start anniversary | R05/R13. |
| W21 | Inactivity/game stats | R05/R07/R12; scoring/governance open. |
| W22 | Velocity and distance trends | R07; manual confirmed; distance conflict D03. |
| W23 | Player birthday and sport | R05/R03. |
| W24 | Paused session balances | R05/R08. |
| W25 | Pause analytics | R08; dictionary/observation windows. |
| W26 | Cancellation Text/history | R09. |
| W27 | Profile links everywhere | R01. |
| W28 | Cancel/hold dates/reasons/history | R08/R09. |
| W29 | GHL/CRM/calendar | R09; **native replaces GHL backend**, C. |
| W30 | Two schedule types | R06; preserve separate camps/evals event scope. |
| W31 | Search linked athlete | R06. |
| W32 | Coach/age retention and actual coach | R03/R06/R07; attribution open. |
| W33 | Persistent bookings/Check-In | R06; confirmed local-only defect. |
| W34 | Coach retention/ratings; remove messaging | R07/R09; adult messaging D10. |
| W35 | New-location Hitting Instructor only | R07; existing records decision open. |
| W36 | Add Coach label | R07. |
| W37 | Every-class rating/multi-coach retention | R07; lesson-share model not yet chosen. |
| W38 | Sessions Done details | R07. |
| W39 | Auto Pay Rate definition | R02; separate enrollment and success. |
| W40 | Actual sold versus list price | R02. |
| W41 | 10/20/50 pagination | R02. |
| W42 | Rating/original hire anniversary | R07/R13. |
| W43 | No-show/cancel drilldown; remove Confirmed | R07. |
| W44 | Retention age/sport/date segments | R03. |
| W45 | Rec/Travel/Both tagging/analysis | R03/R05. |
| W46 | Sticky navigation sitewide | R01. |
| W47 | Unified churn/tenure/age/history | R03; cutoff/late bands D11. |
| W48 | Six exit reasons | R08. |
| W49 | Search/add competitor | R08. |
| W50 | Low-balance ranges/details | R08; date semantics open. |
| W51 | Expiry versus balance | R08; merged screen optional. |
| W52 | Sport/age velocity/distance HitTrax ranks | R07/R10; manual baseline; distance/API gated. |
| W53 | All eligible ranks | R10. |
| W54 | Revised rewards/social/reviews/streak | R10; prohibited incentives excluded; economics/compliance approval. |
| W55 | Six-item catalog/economics | R10. |
| W56 | Payments redesign | R01/R02/R08. |
| W57 | Notice/final payment/interview/waiver | R08; contract/legal approval, no blanket charge/waiver. |

## 9. Updated requirements and meeting-only traceability

| Source | Coverage |
|---|---|
| A1 | R02/R03/R11: tracker placement/metrics/date/sort/comparison, eligible open-location average MRR/history, Network Churn, remove corporate Average Retention. |
| A2 | R11/R02/R03: complete clickable dated location rankings, commercial and operational metrics, benchmarks/counts/rates. |
| A3 | R11/R13: multi-location owner journey, departmental notes/actions, monthly same-calendar benchmarks since opening; same-operating-age comparison optional. |
| A4 | R12: owner Drive library, category/search/version/sync/location permissions; link-only alternative must be approved. |
| A5 | R12: two declines/three observations, owner/leadership notices, booking link/journey/outcomes/reminders. |
| A6 | R12/R09: Marketing navigation both dashboards, corporate events/RSVP/resources, scoped ads/date/history. |
| A7 | R03/R11: nationwide Churn/LTV, no Average Retention, drilldowns/location comparisons/history/date controls. |
| A8 | R12: Trainual access/progress by role; SSO exploratory. |
| A9 | R12/R05: per-user activity, oversight/filter/history/rankings, inactivity thresholds; optional composite score/governance. |
| A10 | R04/R09: Re-Eval tab/count/history/results/notes/progress/next scheduled date and authorized coach/GM/corporate review. |
| A Implementation Notes | Sections 4/5/7/10: definitions before development, historical eligibility/snapshots, owner/corporate separation. |
| M/T83–123, T218–263 | R01: Clubhouse, explicit Dashboard retained alongside Today. |
| M/T343–418, T993–1078 | R02: no speculative new-sales projection; actual paid package analytics with separate estimated LTV. |
| M/T803–838, T2488–2498 | R06: single-occurrence capacity, variable location cages; example cage counts not limits. |
| M/T1083–1128 | R04: persistent checklist/agent; channel alternatives not mandatory. |
| M/T1203–1268, T2423–2438 | R06: scan/Bluetooth exploratory; manual actual-coach check-in baseline. |
| M/T1383–1423, T1493–1538 | R05: manual review/referral tracking and link outreach; free session not approved. |
| M/T1578–1588, T2298–2303; C | R09: SMS/history/pipeline/calling; creator settles native backend. |
| M/T1653–1723 | R04: upcoming-visit ten-day rule, repeat until marked, supersedes 30-day trigger. |
| M/T1733–1818; C | R07/R13: manual average/peak performance, roster convenience, API affordability external. |
| M/T1843–1918 | R07: dated/numbered private notes and staff phone experience, packaging undecided. |
| M/T1993–2048; C | R08/section 6: GM phone price/date/deposit/recurrence, payment alternatives; $99/three weeks only an example. |
| M/T2243–2273 | R08: 30-/60-day automatic holds; three-month/custom suggestion not adopted. |
| M/T2548–2618 | R06: camp purchase full-roster enrollment, separate attendance; 20 capacity only example. |
| M/T2648–2693 | R11–R13: written franchisor scope supplements deferred meeting review. |
| M/T2718–2843; C | R12/R13: marketing desired, simple navigation, aspirational new year, vendor merchandise follow-up and full Mindbody exit. |

## 10. Prioritized delivery proposal and approval gates

No phase has a committed start/end date. All phases require the relevant D decisions and permission/finance approvals first.

| Phase | Proposed priority and dependency | Observable exit evidence |
|---|---|---|
| 0 — Reliability and approved policies | Highest: booking persistence/authorization/error truthfulness, demo audit, dictionary, role matrix, billing policy and source conflicts. | Approved scope/decision register plus reproducible booking/denial evidence and real-data inventory; billing baseline distinguished from new policy. |
| 1 — Daily operations | Depends on phase 0: Today/reevaluation, actual coach, member fields/private notes/lesson balance and approved lifecycle controls. | Shared device completion, correct visit/cycle cases, protected notes and authorized operational workflows. |
| 2 — Finance and retention | Depends on approved definitions and event/history quality: collections/projection/packages, churn/pause/coach metrics and snapshots. | Reconciled ledger/cohorts, historical eligibility, transparent missing data and approved metric examples. |
| 3 — Consumer/staff expansion | Depends on packaging/payment/performance/economic decisions: staff enrollment, camp/capacity, game stats/manual performance and rewards. | Agreed device workflows, camp enrollment without attendance, payment idempotency and costed compliant reward scenarios. |
| 4 — Corporate expansion | Depends on ownership/data/history/access: owner journey, rankings/intervention, Marketing, native CRM delivery integrations, Drive/Trainual/activity. | Verified connector scope and errors, scoped data, deduplicated alerts, lawful communication/telemetry and accurate attribution. |

**Sequence exception:** native CRM may need earlier delivery for complete Mindbody/GHL departure and pilot operation. Leadership must choose minimum CRM and corporate workflows before sequencing; phase placement does not defer an agreed launch requirement silently.

### Required approvals and rollout evidence

1. **Scope gate:** creator/leadership approves this baseline, records exceptions, confirms missing franchisor notes and names decision owners. Open decisions remain explicitly blocked, not silently accepted recommendations.
2. **Policy gate before affected planning:** finance signs dictionary/examples/currency rules; operations approves reevaluation/capacity/balance/coach attribution; security/leadership signs role matrix; finance/legal signs discounts/holds/notice/waivers; compliance/finance signs rewards/privacy.
3. **External feasibility gate before integration planning:** verify authorized provider access, country/device/SDK/subscription/price constraints, number/document ownership, consent, system of record and failure/retry behavior. Provider selection and external contact require separate authorization.
4. **Planning gate:** reconcile the full current board against R01–R13 and existing task history. Create independently executable implementation tasks only after relevant rules are approved. Do not duplicate proposed/completed work.
5. **Pilot gate:** later authorized implementation must demonstrate real data, direct permission denials, financial reconciliation, shared-device booking/checklist behavior and actual scheduled billing lifecycle outcomes in an approved environment.
6. **Migration/go-live gate:** approved historical imports/payment portability or renewed consent, counts/balances/currency reconciliation, support/rollback ownership, pilot sign-off and separately authorized launch. No date or production action is set by this review.

## 11. Explicit optional/deferred ideas

Not mandatory without new approval: Slack/text agent channels; scan/Bluetooth check-in; automatic coach-availability capacity; separate business-app distribution; native Tap to Pay; broader HitTrax/video/API presentation; custom/three-month holds; same-operating-age benchmarks; composite engagement score; combined pack-attention screen; Trainual SSO. Distance is an unresolved source conflict, not silently optional or removed. Required full integrations cannot be accepted as simple links without an approved phase exception.

## 12. Leadership sign-off

| Approval | Record |
|---|---|
| Scope baseline / exceptions | **Creator approved November 18, 2026: “Approve baseline; retain decision gates.”** No additional exceptions supplied. |
| Financial dictionary and formulas | **Pending named finance approver** |
| Roles, note visibility and location boundaries | **Pending named security/operations approvers** |
| Billing transitions, final charge and waiver terms | **Pending finance/legal/operations** |
| External integrations, payment approach and privacy | **Pending named owners and feasibility** |
| Pilot workflows, locations, date/year | **Pending leadership** |

Review acknowledgement must distinguish “approve the scope with these blockers retained” from “approve these business-rule answers.” Neither is authorization to implement all changes. No software changes, live account actions, outbound messages, provider selection or deployment were made for this review.
