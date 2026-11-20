# Research Notes: Clubhouse CRM Scope

**Status:** complete
**Depth:** Standard

## Plan
- **Question:** What should the design scope include to combine HighLevel-style messaging, pipelines and workflows with modern CRM usability and safe AI assistance for Infinite Hitting?
- **Scope:** Evidence-based design requirements and task revision only; no UI build, providers, sends or production changes.
- **Audience:** Creator and Infinite Hitting leadership.
- **Deliverable:** Downloadable scope review, source comparison, priorities, approval gates and revised Task #606.

## Focus Areas
| # | Area | Status | Sources |
|---|---|---|---|
| 1 | HighLevel messaging, pipelines and automation baseline | reviewed | 3 full pages in registry |
| 2 | Modern shared inbox and human/AI collaboration | reviewed | 5 full pages in registry |
| 3 | Modern contact models, pipelines and CRM usability | reviewed | 3 full pages in registry |
| 4 | Journey orchestration and workflow operations | reviewed | 10 full pages in registry |
| 5 | Multi-location communication safety and governance | reviewed | 3 full pages in registry |

## Coverage Checklist
- [x] HighLevel baseline: shared conversations, configurable opportunities, visual trigger/action automation, waits/branches and logs.
- [x] Modern staff UX: saved work queues, ownership, reply collision indicators, contextual record panels and progressive disclosure.
- [x] AI: summaries, editable drafts and proposed workflow edits; human approval, permission-scoped context and no autonomous financial changes.
- [x] Workflow behavior: simulate by default, distinguish live tests, versioned publish, exits/re-entry, caps, rescheduling and safe recovery.
- [x] Domain model: guardian identity, athlete context, siblings, shared phone review and location-scoped thread permissions.
- [x] US/Canada gates: consent evidence, suppression, sender ownership and applicable legal/privacy review; no compliance certification.
- [x] Priorities: design essential behaviors completely, label later channels/experiments, exclude full marketing-suite clone.
- [x] Acceptance: linked screens, behavior specification, parity matrix, exception scenarios and explicit implementation handoff.

## Findings Log
24 complete primary-source pages registered in research/sources.json; additional snippet leads retained but not used for specific report claims.

### HighLevel baseline
- Pipeline stage editing includes safe handling of existing opportunities. [@highlevel-02-pipelines-opportunities]
- Workflow triggers/actions/branches and logs are baseline; AI-generated workflows still need review. [@highlevel-03-workflow-basics] [@highlevel-04-ai-builder]

### Modern inbox and records
- Ownership, private collaboration and reply-presence address real team work. [@inbox-01-intercom-assignments] [@inbox-02-front-collision]
- AI assist and human handoff are documented; no quality/safety guarantee inferred. [@inbox-04-front-copilot-summary] [@inbox-05-intercom-ai-inbox]
- Linked records/views and required stage information inform family-aware design. [@crm-01-attio-data-model] [@crm-03-hubspot-pipelines]

### Workflow safety
- HubSpot simulated workflow traversal executes no actual actions; separate test email is an explicit action. HighLevel Test Workflow explicitly performs real actions. [@journeys-05-hubspot-workflow-test] [@journeys-07-highlevel-test-workflow]
- Entry limits, exit conditions, frequency caps and quiet hours are distinct controls. [@journeys-01-customerio-triggers] [@journeys-02-customerio-exit-conditions] [@journeys-03-customerio-frequency-limits] [@journeys-04-customerio-sms-quiet-hours]
- November Customer.io updates substantiate relational triggers and experimentation; they do not prove conversion uplift. [@journeys-11-cio-object-trigger] [@journeys-08-customerio-nov-2026-experiments]

### Governance
- Sender/recipient-specific permission and opt-out evidence affect every send; CASL and COPPA applicability require specialist review. [@governance-01-twilio-messaging-policy] [@governance-02-crtc-commercial-text-guidance] [@governance-03-ftc-coppa-faq]

## Conflicts & Open Questions
- “All HighLevel features” needs a feature-level matrix; it is not an approved unlimited parity commitment.
- Vendor documentation establishes advertised behavior, not independent proof of effectiveness, availability or suitability.
- Staff messaging permissions, providers and final workflow policies remain approval gates.
- Product-specific claims are explicitly single-vendor evidence, not triangulated independent rankings. Three-source synthesis supports design patterns, not superiority claims; no product feature is “confirmed” by a different vendor.
- HighLevel real-action tests versus HubSpot simulation is a documented difference, not a contradiction; Clubhouse recommendation is simulation by default with live testing separated.
- AI-generated summaries and workflows are not source records or approval to send.

## Gaps
- Logged-in competitor usability and live provider feasibility are not tested by this review.
- Full HighLevel action/integration parity, vendor plan eligibility, commercial pricing and detailed legal applicability moved to Limitations.
- Exact multi-location legal sender topology, opt-out scope and guardian policies require business/provider/legal approval, not another generic web search.
- Latest-release sweep completed in each research area; unverified Front/HubSpot third-party release claims excluded. November official releases cited only for their stated features.

## Final outcome
- Revised existing Task #606; no duplicate implementation task created.
- Delivered `research/crm-scope-review.html` and matching Markdown with 24 rendered, clickable citations and retained evidence.
- Verified evidence paths, citation resolution and self-contained HTML structure.
- No application code, providers, live messages, workflow execution or production settings changed.
