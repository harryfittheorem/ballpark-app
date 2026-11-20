# Five-slide owner presentation

Prepared 12 November 2026. This supersedes the earlier briefing's inclusion of HitTrax as a future offering: the user reports that Infinite Hitting has requested removal of the integration. This is a **planned scope change**, not completed removal. No application code was changed for this presentation.

## Slide 1 · We already have the foundation

Main message: “We are not starting from scratch.”

- Built in code: family accounts and booking; coach messages and drills; points, rewards and rankings; staff/owner tools and billing workflows.
- Documented payment tests: renewals, declines and retries on Frisco's Stripe test-mode account.
- Still to prove: real Mindbody export compatibility and live Clearwater operations.

Talk track: “These are features we can demonstrate, not a claim that migration or live billing is certified. The work now is to bring over the correct information and stabilize what is already built.”

Evidence: current code and dated test boundaries in `TECHNICAL-APPENDIX.md`, C1–C14 and T1. Do not repeat older marketing claims as measured outcomes.

## Slide 2 · Why make the move?

- Tailored to Infinite Hitting: adapt workflows to our families, coaches and location operations rather than fit a generic system.
- Built-in retention tools: attendance and drills can earn points, with rewards and rankings giving athletes reasons to return.
- Connected experience: booking, coaching and rewards together; location reporting can support consistent operations once validated.

Talk track: “Customization gives us control over our roadmap. The reward system is already built; stronger retention is the intended benefit, not a guaranteed result. We should measure repeat bookings, attendance, reward participation and renewal/cancellation trends against a pre-launch baseline.”

No percentage retention lift, cost savings, ownership of vendor IP, exclusive capability or guaranteed business outcome is asserted.

## Slide 3 · What we need from Mindbody

- Owner-led access: confirm Clearwater's source site, shared locations, merchant/vault ownership, fees and safe continued billing.
- Complete business records: households, plans/prices, next charge dates, credits, bookings and history; obtain available original agreements through approved channels and review missing evidence.
- Separate payment transfer: Mindbody/payment custodian → Stripe's approved secure process; then map customers/cards and recreate future billing.

Talk track: “No card re-entry remains a required gate, not a proven capability. Importing an active membership does not create autopay. Mindbody's published export rules are whole-site and cancellation-linked; a shared site may block a Clearwater-only export. We need written answers before committing. Signed waiver documents/client forms are not included in the standard export described by the FAQ, so archive planning and legal review matter.”

Keep old billing authoritative until verified handoff. Never route card numbers or security codes through this app, workspace or email.

Sources S1–S3 in `OWNER-BRIEFING.md` (retrieved 12 November 2026).

## Slide 4 · Simplify, stabilize, then pilot

**Proposed five-stage confidence roadmap, not a committed delivery schedule:**

1. **Remove and stabilize · target about two weeks.** Remove HitTrax linking, imports and related stats/screens; review dependent rewards/achievements and historical-data retention. Keep attendance, drills and non-sensor engagement. Stabilize core workflows. Owner-led vendor discovery can run alongside this work.
2. **Internal scenario testing · advance on evidence.** Exercise accounts/roles, booking/cancellation, credits, coaching, rewards, notices, billing dates, renewals/declines/retries and reporting using authorized test data and Stripe test mode. Review real export mapping separately in an approved isolated environment. Exit: documented results, no unresolved critical defects, and safe comparison setup.
3. **Owner and staff hands-on trial · timebox agreed with them.** Guided practice followed by realistic independent tasks; named feedback/issue owners, fix and retest. Exit: staff can complete their agreed workflows and sign off. Invite selected families only with an approved non-collecting trial and appropriate permissions.
4. **Shadow alongside Mindbody · target about one week after prerequisites pass.** Mindbody remains the source of truth for billing, bookings and balances. The new app is a controlled comparison/rehearsal environment: no new payment collection, live autopays/retries, duplicate customer notices, real reservations or credit/reward consumption caused by shadow actions. Use authorized snapshots/daily changes and reviewed manual comparisons if needed; no automatic synchronization capability is assumed. Compare bookings, credits, membership status, expected dues and reports each day; resolve differences and reset/replay shadow actions as needed.
5. **Separate go/no-go → small Clearwater cohort → monitored expansion.** Sponsor, finance and operations approve based on evidence, not elapsed days. Card eligibility/no-re-entry, source-stop proof, final deltas, reconciled obligations, legal review and fallback must pass. Only then switch collector authority for approved members. Observe actual renewals/settlements through an appropriate full billing cycle before wider rollout.

Talk track: “You do not have to trust a date. First we show our test evidence; then your team tries the app; then we compare a normal operating week without putting your current collections at risk. You see what passed, what remains open and who owns it. You choose whether to proceed.”

**Timing:** about two weeks of stabilization and about one week of shadow comparison are planning estimates, not promises. Internal testing, their trial, remediation and vendor transfer timing add time. The prior 30-day Clearwater target is conditional and must be reforecast after discovery; these stages are not squeezed into a fixed Day 30 cutover. One comparison week cannot certify a monthly billing cycle. Confirm whether owners intended Clearwater or network-wide timing.

No data deletion, HitTrax removal, live test, source integration, export or parallel operation was performed for this presentation task.

## Slide 5 · A familiar migration approach—with clear safeguards

Two **documented vendor approaches**, not customer case studies or guarantees:

1. **HubSpot CRM guidance:** map and clean data, rehearse in a non-production environment, validate users/reports, train staff and provide post-launch stabilization.
2. **Stripe payment guidance:** move saved payment methods securely, recreate subscriptions separately, preserve billing dates and review future schedules before collection.

Our approach: rehearse → reconcile → approve → switch a controlled cohort → monitor.

Approval requested: authorize discovery and a gated Clearwater pilot. No automatic permission to cancel Mindbody, start new charges or launch the network. One authorized collector per member; verify old autopay/retries are stopped before new billing can collect. No-card-re-entry eligibility must pass or affected cutover is held.

Talk track: “This is not an unusual type of business change. Established vendors document the same pattern: preparation, test loads, validation, training and monitoring. Payment portability adds its own provider-dependent gate. These examples explain the method; they do not establish success for Infinite Hitting or prove our rollback tooling works.”

**Make trust observable:** name a migration lead, finance lead and Clearwater manager before work starts. Share a short weekly scorecard: agreed scenarios passed/failed, open critical issues and owners, trial feedback resolved, and readiness/next decision. During shadow week, add a daily comparison of bookings, balances, expected dues and report differences. Record finance/operations signoff and demonstrate the provider-approved hold/fallback process before any billing switch. Give owners an explicit “not yet” option; an unresolved critical defect, unexplained financial variance or failed no-re-entry gate means hold. A green scorecard must be backed by observed evidence, not populated with demo numbers.

## Additional primary-source references

Accessed 12 November 2026; general vendor guidance, not account-specific approval:

- [HubSpot, CRM migration guide](https://blog.hubspot.com/sales/crm-migration-guide), page updated 29 October 2026. Body retrieved; covers mapping, test loads, cutover, user validation, training and stabilization.
- [HubSpot, CRM data migration process](https://blog.hubspot.com/marketing/crm-data-migration), page updated 16 July 2026. Body retrieved; supports phased business change, sandbox rehearsal, final deltas and hypercare. Do not adopt its generic email matching or tolerance examples as this project's acceptance policy.
- [Stripe, Import payment data](https://docs.stripe.com/get-started/data-migrations/pan-import), retrieved during the underlying briefing research. Secure transfer, separate subscription migration and provider-dependent timing.
- [Stripe, Import subscriptions using APIs](https://docs.stripe.com/billing/subscriptions/import-subscriptions), retrieved during the underlying briefing research. Legacy price/customer mapping, billing continuity and future schedules.
- [Mindbody, Subscriber data export FAQ](https://support.mindbodyonline.com/s/article/I-need-to-export-my-Data-Subscriber-Data-Export?language=en_US), dated 26 August 2026; retrieved during the underlying briefing research despite a cookie-banner error. Whole-site/cancellation restrictions and waiver/form exclusions.

The deck should contain **exactly five slides**. These notes and links are a separate handout, not additional slides.
