# Clubhouse CRM: Leadership Scope Review

**Research Date:** November 20, 2026  
**Depth:** Standard, primary-source product and design review  
**Sources Consulted:** 24 complete primary-source pages  
**Status:** Recommendation for design approval; not authorization to build or send communications.

## Executive Summary

Clubhouse should use HighLevel as the familiarity baseline for conversations, opportunities and visual automation, but should not copy its entire product catalog. The design objective is a family-aware, multi-location operational CRM: a GM can see who needs attention, understand the family and player context, reply safely, and move the relationship forward without opening several systems. This is a proposed product direction, not a claim that a vendor has been independently ranked best.

The current design task covers the right major screens but leaves important behavior underspecified. HighLevel documents configurable pipelines and visual workflows; Intercom and Front document team ownership and collaborative inbox patterns; Attio documents flexible linked records; Customer.io documents journey entry, exit and communication controls. Together these support a coherent design direction, not a guarantee of feature parity or better commercial results. [[1]](https://help.gohighlevel.com/support/solutions/articles/155000001982-understanding-pipelines) [[2]](https://help.gohighlevel.com/support/solutions/articles/155000002288-getting-started-with-workflows) [[3]](https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams) [[4]](https://help.front.com/en/articles/2403) [[5]](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views) [[6]](https://docs.customer.io/journeys/campaign-triggers/)

The recommended upgrade is to specify the behavior behind the screens: one accountable owner per conversation, correct guardian and sender identity, duplicate-response protection, explainable work queues, controlled workflow publication, message caps, safe simulations, and visible recovery when something fails. AI should initially summarize, draft and propose actions; it should not independently change billing, infer consent, merge people or publish campaigns. These are Clubhouse recommendations, not features already implemented.

Task #606 should deliver an interactive design and a behavior contract, including failure and permission states. Task #605 remains a narrower foundation task: it must not silently absorb a production workflow engine, live messaging, provider selection or unrestricted AI. Approve the design, feature matrix and decisions first, then reconcile implementation scope.

## Background

The creator asked for a state-of-the-art experience inspired by HighLevel and current offerings, with two-way texting, continuous conversation history, opportunity pipelines and milestone/date-based visual workflows. This review extends that request beyond a list of screens without beginning those screens or the application build.

The benchmark spans HighLevel for familiar CRM automation, Front and Intercom for inbox teamwork, Attio and HubSpot for record/pipeline usability, and Customer.io for customer journeys. Official vendor documentation is suitable evidence of described product behavior, but not independent proof of reliability, effectiveness, superiority or availability on a particular plan. “Latest” means features found in the sources retrieved on the research date; this is not an exhaustive market ranking.

A limited source-code check found that the current portal labels the members area “Members CRM,” while its coach inbox groups conversations by athlete and uses the existing in-app message records. Member detail includes an email-oriented message action. This is a useful foundation, not demonstrated shared SMS CRM capability. No runtime or production acceptance was performed, and this review is not a security audit.

## Key Findings

### 1. Borrow specific patterns, not whole products

| Reference | Verified inspiration | Proposed Clubhouse application |
|---|---|---|
| HighLevel | Configurable pipeline stages, trigger/action workflows and AI-assisted workflow editing. [[1]](https://help.gohighlevel.com/support/solutions/articles/155000001982-understanding-pipelines) [[2]](https://help.gohighlevel.com/support/solutions/articles/155000002288-getting-started-with-workflows) [[7]](https://help.gohighlevel.com/support/solutions/articles/155000006100-ai-builder-overview) | Familiar Conversations / Opportunities / Workflows structure and editable visual sequences. |
| Front | Reply indicators and shared drafts; Copilot can summarize and help compose. [[4]](https://help.front.com/en/articles/2403) [[8]](https://help.front.com/en/articles/4848832) | Show who is replying and offer editable AI drafts, without treating presence as a guarantee against simultaneous sends. |
| Intercom | Individual/team assignment, AI-to-human handoff and conversation assistance. [[3]](https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams) [[9]](https://www.intercom.com/help/en/articles/6955446-ai-features-available-in-the-inbox) | Clear ownership, escalation and a human takeover state. |
| Attio | Distinction between canonical objects, lists and views; record summaries have data-sharing constraints. [[5]](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views) [[10]](https://attio.com/help/reference/managing-your-data/records/record-summaries) | Linked guardians/athletes, saved queues and permission-scoped summaries with source context. |
| HubSpot | Conditional stage properties, workflow simulation and execution history. [[11]](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines) [[12]](https://knowledge.hubspot.com/workflows/test-your-workflow) [[13]](https://knowledge.hubspot.com/workflows/understand-your-workflow-details-page?facet1=crm) | Ask for relevant information at the right stage; preview automation paths and explain actual outcomes. |
| Customer.io | Separate journey-entry frequency, exit conditions, message caps and quiet hours. [[6]](https://docs.customer.io/journeys/campaign-triggers/) [[14]](https://docs.customer.io/journeys/campaign-exit-conditions/) [[15]](https://docs.customer.io/messaging/send/timezones/message-limits) [[16]](https://docs.customer.io/messaging/channels/sms/quiet-hours/) | Control eligibility and total communication across all journeys, not merely within one workflow. |

Recent official examples include HighLevel’s November 4 AI Builder documentation, Intercom’s November 13 repeat-conversation merge announcement, and Customer.io’s November 2 relationship-aware object trigger and November 9 automation experiments releases. These establish current design references, not that Clubhouse should ship autonomous agents, automatic merging or experiments at launch. [[7]](https://help.gohighlevel.com/support/solutions/articles/155000006100-ai-builder-overview) [[17]](https://www.intercom.com/changes/en/163642-merge-repeat-conversations-in-one-go) [[18]](https://docs.customer.io/release-notes/2026-11-02-new-object-trigger/) [[19]](https://docs.customer.io/release-notes/2026-11-09-experiments/)

The design recommendation is progressive disclosure. GMs should see an actionable inbox and next steps; administrators can open advanced automation and settings. A polished product does not require exposing every configuration control to every employee.

### 2. Design a work system, not separate CRM pages

The proposed navigation is **Overview, Conversations, Contacts, Opportunities, Workflows, Templates, Reports**, with sender/consent/permission configuration under restricted Settings. Overview should prioritize “needs reply,” “unassigned,” “follow-up due,” “stalled opportunity,” and “automation needs attention.” It should show evidence and an action, rather than inventing an opaque engagement score.

The inbox should use collapsible queues, a searchable conversation list, the active thread and a contextual family panel. The user should be able to reply, assign an owner, add an internal note, create a task and open an opportunity without losing thread context. Private notes must look unmistakably different from customer replies. Reassignment and automation changes belong in the activity history.

Reply presence is useful but insufficient: two staff members can still send at once or work from stale screens. The design must show when another person has sent since a draft began, preserve the draft and require a fresh review before a conflicting send. Provider failures, reconnecting state, queued sends and unknown delivery must never appear as successful delivery. Ordinary SMS must not show invented read receipts.

Contacts should use saved views and inline quick actions, with full forms reserved for complex edits. A command/search interface and keyboard navigation can speed desktop work; phone layouts should prioritize search, unread threads, replies and follow-ups. On phones, a queued draft must remain visibly unsent when connectivity is unavailable. Accessibility, focus handling and touch controls are essential design acceptance, not cosmetic extras.

### 3. Family and location context must be correct before communication

The central record is not simply a “lead.” It is an adult contact linked to family/household and athlete records, with opportunities and visits attached to the right context. A shared email address or phone number is not enough to conclude two people are the same. Attio’s linked-record approach and HubSpot’s staged data requirements provide useful precedents, but this domain model is a Clubhouse recommendation. [[5]](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views) [[11]](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines)

A unified history must not mean combining every guardian’s private messages. Proposed thread identity should account for the authorized adult recipient, location/business sender, channel endpoint and participants. A family panel can show related athletes without revealing another guardian’s conversations or another location’s restricted records. Multiple opportunities per household may be legitimate: a sibling trial and a returning player should not overwrite one another.

Before sending, the composer should show the adult recipient, related player where relevant, sender location/number, channel, and permission state. Missing guardian authority, ambiguous phone ownership or missing consent should produce a clear blocked state and a resolution path—not a guessed recipient.

Corporate should be able to propose shared templates and workflow versions, but location activation and cross-location visibility require an explicit policy. Design a version diff, permission check and location approval step; never let a corporate edit silently change live messages across every location.

### 4. Workflow capability includes timing, safety and operation

The desired workflow builder is real configurable logic, not a few hard-coded reminder toggles. Proposed node families are triggers, filters, waits, branches, messages, internal tasks, assignments, field/tag updates, opportunity changes and explicit exits. Trigger context must identify whether a run belongs to a guardian, athlete, opportunity, appointment or membership.

The following distinctions must be visible:

| Control | Question it answers |
|---|---|
| Entry eligibility | Who qualifies, based on which event and current facts? |
| Re-entry/deduplication | Can the same event or relationship start another run? |
| Wait and reschedule | What happens when an appointment or next billing date changes? |
| Exit/goal | Does the contact terminate, skip forward or simply record conversion? |
| Frequency cap | How much communication is allowed across all active workflows? |
| Quiet hours/timezone | When may this recipient receive this kind of communication? |
| Human takeover | Which automation pauses when staff or the recipient responds? |
| Version and recovery | Which definition is a waiting run using, and what can safely be retried? |

Customer.io documents distinct entry, exit, caps and SMS quiet-hour mechanisms; HighLevel documents goal movement and behavior for contacts already waiting. Those differences show why a Clubhouse behavior specification is necessary rather than copying control labels. [[6]](https://docs.customer.io/journeys/campaign-triggers/) [[14]](https://docs.customer.io/journeys/campaign-exit-conditions/) [[15]](https://docs.customer.io/messaging/send/timezones/message-limits) [[16]](https://docs.customer.io/messaging/channels/sms/quiet-hours/) [[20]](https://help.gohighlevel.com/support/solutions/articles/155000001254-workflow-builder-walkthrough)

An important verified difference is testing. HubSpot documents simulated workflow paths without actual workflow actions, while HighLevel’s Test Workflow documentation explicitly says tests execute real actions, including messages and record creation. Clubhouse should recommend **Simulate** as the default and reserve **Live test** for a separate, clearly warned, allowlisted staff-only process after implementation approval. Neither mode should be labeled a safety guarantee. [[12]](https://knowledge.hubspot.com/workflows/test-your-workflow) [[21]](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow)

The proposed builder should preview recipient, sender, resolved variables, estimated send time and branch reason. It needs publication validation, named approval, version notes and an explicit rule for existing runs. Pause must state whether it blocks new entries, queued sends or both. Recovery should check previous provider state before retrying an uncertain send; repeating an SMS is not equivalent to rerunning a calculation.

The activity log should explain “why enrolled,” “why skipped,” “why delayed,” “why blocked” and “who approved.” Show unknown outcomes honestly. A failure center should let authorized staff inspect and resolve problems without offering a misleading universal undo.

### 5. AI should be useful, inspectable and permission-bound

HighLevel documents natural-language workflow generation/editing, while Front and Intercom document contextual assistance and human involvement. These are sufficient precedents for assisted work, not evidence that unrestricted autonomous execution is appropriate for youth-sports operations. [[7]](https://help.gohighlevel.com/support/solutions/articles/155000006100-ai-builder-overview) [[8]](https://help.front.com/en/articles/4848832) [[9]](https://www.intercom.com/help/en/articles/6955446-ai-features-available-in-the-inbox)

| Proposed AI ability | Recommended boundary |
|---|---|
| Summarize a conversation or family history | Label as generated, show update time, link source activity and omit restricted context. |
| Draft/refine a reply | Staff edits and explicitly sends; preserve selected recipient and sender. |
| Suggest next action or task | Explain the evidence; staff accepts or dismisses. |
| Turn natural language into a workflow draft | Show assumptions, unsupported nodes and a before/after diff; require simulation and publication approval. |
| Execute a task | Only an explicitly approved action within the actor’s role; no privilege expansion. |
| Infer consent, merge guardians, change billing or publish campaigns | Not allowed as unattended AI actions in the proposed initial scope. |

The interface must distinguish “AI drafted this” from “the system sent this.” Generated text should not promise refunds, slots, discounts, contract changes or performance outcomes unless an authorized source supports the statement. Customer messages are untrusted content, not instructions that can grant an agent extra access. The design should include AI unavailable, insufficient evidence, stale summary and approval declined states.

### 6. Consent and operational visibility belong in the product

Twilio’s messaging policy requires recipient/sender-specific permission and retained evidence and addresses revocation; CRTC guidance describes consent and unsubscribe expectations for commercial texts; FTC COPPA guidance describes obligations for covered child-directed or child-data collection services. These are scoped authorities, not a combined legal determination for Clubhouse. [[22]](https://www.twilio.com/en-us/legal/messaging-policy) [[23]](https://crtc.gc.ca/eng/contact/spam/q23.htm) [[24]](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)

The design recommendation is a visible consent record by recipient, channel, purpose and business identity, with evidence and change history. Suppression must be enforced at execution time, including queued messages, not only when a workflow starts. Staff must not be able to bypass suppression by dragging a card or changing a tag. Exact suppression scope across legal entities and the handling of service versus marketing messages require approved provider/legal policy.

Operational reporting should distinguish queued, attempted, provider-accepted, delivered where supported, failed and unknown; first human response should be distinct from automated acknowledgment. Pipeline conversion needs defined cohorts and denominators. Experiment results and attribution should never be described as causal proof without a defensible method. Message volume, estimates of usage cost and budget thresholds should be designed, but no provider price is asserted here.

## Analysis: Proposed scope and priorities

“State-of-the-art” should mean fewer errors and less staff effort, with modern assistance where useful. A large action catalog or autonomous agent label is not sufficient. The following priorities are recommendations to approve, not unilateral reductions of the request for workflow functionality.

| Priority | Design coverage | Implementation implication |
|---|---|---|
| Essential operating core | Family-aware records, shared SMS inbox, assignments, internal notes, follow-ups, pipelines, guardian/sender checks, permissions, history and failure states. | Reconcile against the narrower foundation task; live sending remains gated. |
| Essential automation contract | Visual triggers/actions, waits, dates, conditions, replies/timeouts, exits, re-entry, caps, quiet hours, simulation, versioning and execution logs. | A substantial subsystem, not a small addition to contact screens. |
| Modern assist | Search/command actions, saved views, reply collision handling, explainable next steps, generated summaries and editable drafts. | Scope and evaluate AI separately; useful manual operation must remain available. |
| Advanced roadmap shown in design | Natural-language workflow drafting, richer email/calls, approved bulk campaigns, corporate template rollout, branching experiments and integrations. | Explicit later phases or leadership-promoted launch requirements; not silently promised. |
| Outside this initiative | Full HighLevel website/funnel/store suite, ad buying, telephony infrastructure, autonomous finance, unrestricted agents and direct coach-to-player outreach. | Separate business case and approval if ever requested. |

Email, calling and bulk campaigns need design placeholders with honest unavailable states and clear channel expansion rules. They should not be shown as operational if provider ownership, consent, inbound routing or recording policy is unresolved. Sample pipeline names, suggested sending intervals and response targets are recommendations, not established business policy.

The design should demonstrate seven linked scenarios: new lead to booked evaluation; evaluation cancellation/no-show recovery; multi-athlete guardian communication; prospect-to-member conversion preserving history; onboarding and approved milestones; attendance lapse and staff reevaluation action; and multi-location escalation/template update. Reevaluation must preserve the upcoming-visit/within-ten-days-of-next-payment rule and repeat-until-complete behavior, with open cycle/no-show rules resolved before implementation. It is not permission to automatically send sales texts.

Approval-ready artifacts should include the information architecture, clickable desktop/phone flows, visual system, source-to-feature matrix, trigger/action catalog, workflow behavior tables, role/location matrix, AI authority matrix, exception-state gallery and a prioritized implementation handoff. Existing task status is not a substitute for approving those artifacts.

## Limitations

This review is documentation-based, not a hands-on comparison of paid accounts or an independent performance study. Most feature evidence is official vendor documentation, classified as Tier 3 under the research scale; regulator guidance is Tier 1. A product-specific capability is marked by its own source rather than falsely “verified” by three different vendors. Cross-source synthesis informs recommendations but does not establish superiority.

No vendor subscription eligibility, price, API quota, sender registration, cross-border legality, AI data-processing terms or production feasibility has been certified. Exact HighLevel parity remains a feature-level exercise during design. Unverified third-party “latest release” claims were excluded. Official release notes and dynamically maintained pages may change.

No production data, export, private recording, live message, workflow run or application behavior was tested. Legal applicability, retention periods, guardian authority, staff communication privileges, sender ownership and the launch channel mix still require named approvers. Provider examples are references, not selections.

## Recommendations and approval gates

Revise Task #606 around this operating model before producing visual mockups. Keep the visual workflow builder and two-way conversation design central; do not downgrade either to a static feature checklist. At the same time, define a manageable first-release contract rather than an unlimited promise to reproduce every HighLevel integration.

Leadership should approve the screen map, required first-release channels, pipeline stages and role/location access. Operations should approve next-action queues, reassignment, human takeover, task carry-forward and the reevaluation cycle rule. The communications/privacy owner should approve sender ownership, guardian routing, consent/suppression policy, retention and escalation. Automation owners should approve trigger semantics, timezones, caps, exits, version behavior and publication powers.

Before implementation planning, acceptance walkthroughs should prove on the design that two staff cannot accidentally duplicate a reply without warning; an opted-out guardian cannot receive queued outreach; a moved appointment does not retain a stale reminder; a shared phone does not silently merge unrelated adults; a staff member cannot reveal another location’s restricted messages; and AI cannot publish or send beyond the approved action boundary.

The immediate next deliverable is the reviewed design and explicit decisions, not production CRM code. After approval, reconcile the foundation task and scope the automation engine, messaging delivery and optional AI/integrations with their own evidence and verification requirements.

## Sources

1. [Pipelines in HighLevel | Manage Opportunities & Sales Stages : HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000001982-understanding-pipelines) — Published/updated: Tue, 3 Feb, 2026 at 6:51 PM; Tier 3. Evidence: `research/sources/highlevel-02-pipelines-opportunities.md`.
2. [Getting Started with Workflows in HighLevel : HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000002288-getting-started-with-workflows) — Published/updated: Thu, 27 Aug, 2026 at 7:15 PM; Tier 3. Evidence: `research/sources/highlevel-03-workflow-basics.md`.
3. [Assign conversations to teammates and teams | Intercom Help](https://www.intercom.com/help/en/articles/6561699-assign-conversations-to-teammates-and-teams) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/inbox-01-intercom-assignments.md`.
4. [Front's real-time collision detection](https://help.front.com/en/articles/2403) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/inbox-02-front-collision.md`.
5. [Define your data model: attributes, views, lists and objects | Attio Help Center](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/crm-01-attio-data-model.md`.
6. [Automation triggers, filters, and frequencies - Customer.io Documentation](https://docs.customer.io/journeys/campaign-triggers/) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-01-customerio-triggers.md`.
7. [Workflow AI Builder: Generate and Edit Workflows with AI : HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000006100-ai-builder-overview) — Published/updated: Wed, 4 Nov, 2026 at 12:33 AM; Tier 3. Evidence: `research/sources/highlevel-04-ai-builder.md`.
8. [Get real-time conversational assistance in your inbox with Copilot](https://help.front.com/en/articles/4848832) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/inbox-04-front-copilot-summary.md`.
9. [AI features available in the Inbox | Intercom Help](https://www.intercom.com/help/en/articles/6955446-ai-features-available-in-the-inbox) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/inbox-05-intercom-ai-inbox.md`.
10. [Record summaries | Attio Help Center](https://attio.com/help/reference/managing-your-data/records/record-summaries) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/crm-02-attio-record-summaries.md`.
11. [Set up and manage object pipelines](https://knowledge.hubspot.com/object-settings/set-up-and-customize-pipelines) — Published/updated: November 17, 2026; Tier 3. Evidence: `research/sources/crm-03-hubspot-pipelines.md`.
12. [Test your workflow](https://knowledge.hubspot.com/workflows/test-your-workflow) — Published/updated: October 28, 2026; Tier 3. Evidence: `research/sources/journeys-05-hubspot-workflow-test.md`.
13. [Understand your workflow details page](https://knowledge.hubspot.com/workflows/understand-your-workflow-details-page?facet1=crm) — Published/updated: October 26, 2026; Tier 3. Evidence: `research/sources/journeys-09-hubspot-workflow-details.md`.
14. [Automation exit conditions - Customer.io Documentation](https://docs.customer.io/journeys/campaign-exit-conditions/) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-02-customerio-exit-conditions.md`.
15. [Set up message frequency limits - Customer.io Documentation](https://docs.customer.io/messaging/send/timezones/message-limits) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-03-customerio-frequency-limits.md`.
16. [SMS: quiet hours - Customer.io Documentation](https://docs.customer.io/messaging/channels/sms/quiet-hours/) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-04-customerio-sms-quiet-hours.md`.
17. [Merge repeat conversations in one go | Intercom Changelog & Release Notes | Product Updates](https://www.intercom.com/changes/en/163642-merge-repeat-conversations-in-one-go) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/inbox-06-intercom-nov2026-update.md`.
18. [A new object trigger that meets more of your needs - Customer.io Documentation](https://docs.customer.io/release-notes/2026-11-02-new-object-trigger/) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-11-cio-object-trigger.md`.
19. [Run experiments in your automations - Customer.io Documentation](https://docs.customer.io/release-notes/2026-11-09-experiments/) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 3. Evidence: `research/sources/journeys-08-customerio-nov-2026-experiments.md`.
20. [Workflow Builder Walkthrough in HighLevel | Automation Guide : HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000001254-workflow-builder-walkthrough) — Published/updated: Mon, 7 Sep, 2026 at 10:50 AM; Tier 3. Evidence: `research/sources/journeys-10-highlevel-builder.md`.
21. [Test Workflow : HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000009235-test-workflow) — Published/updated: Mon, 9 Nov, 2026 at 2:25 AM; Tier 3. Evidence: `research/sources/journeys-07-highlevel-test-workflow.md`.
22. [Twilio Messaging Policy | Twilio](https://www.twilio.com/en-us/legal/messaging-policy) — Published/updated: April 13, 2026; Tier 3. Evidence: `research/sources/governance-01-twilio-messaging-policy.md`.
23. [Help centre | What emails and text messages are allowed under Canada’s Anti-Spam Legislation? | CRTC](https://crtc.gc.ca/eng/contact/spam/q23.htm) — Published/updated: 2026-11-04; Tier 1. Evidence: `research/sources/governance-02-crtc-commercial-text-guidance.md`.
24. [Complying with COPPA: Frequently Asked Questions | Federal Trade Commission](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) — Published/updated: Not reliably established from retrieved page; accessed 2026-11-20; Tier 1. Evidence: `research/sources/governance-03-ftc-coppa-faq.md`.
