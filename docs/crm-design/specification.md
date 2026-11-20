# Clubhouse CRM

## Leadership design and operating contract

**Design for review · November 20, 2026 · Sample data only**

Clubhouse is a family-aware operating CRM for Infinite Hitting locations. It brings adult/guardian conversations, athlete context, follow-ups, opportunities and configurable workflows into one experience. HighLevel supplies a familiar baseline; shared-inbox teamwork, linked records and explainable automation inform the proposed improvements.

This package is a proposal, not an approved launch commitment. The interactive prototype performs local simulations only. No channel is connected, no message is sent and no production data is altered. “Essential” below means essential design coverage and recommended implementation priority, not already available software.

## 1. What is new

| Capability | What staff will be able to do after approved implementation |
|---|---|
| Shared conversations | Receive and send approved adult/guardian SMS from the location identity, with accountable ownership, internal collaboration and delivery evidence. |
| Family-aware contacts | Work with one linked family, authorized adults and separate athletes instead of duplicating a household for every sales activity. |
| Tags and audiences | Manually or automatically apply scoped tags, build dynamic audiences, preview eligible adults and explain exclusions. |
| Opportunities | Manage multiple athlete/program opportunities through configurable stages with next steps and stage history. |
| Visual workflows | Compose triggers, filters, waits, branches, messages, tasks, tag changes and exits; simulate and approve versions before activation. |
| Location connections | Manage a separate Twilio SMS connector per location; optionally connect a business-owned Gmail/Workspace mailbox after feasibility approval. |
| Operational reporting | See human response, pipeline movement, message outcomes, blocked automation and usage without invented attribution. |
| Assistance and governance | Review sourced AI drafts, team collision warnings and corporate version proposals without surrendering permission or publication control. |

Not included: an entire HighLevel website/funnel/store/ads platform, unlimited vendor parity, autonomous AI sending, direct coach-to-player messaging, automatic billing changes or a new native mobile app. Phone designs are responsive staff portal views.

## 2. Evidence, current product and benchmark

The earlier [scope review](../../research/crm-scope-review.md) documents 24 retrieved official pages. Its [source registry](../../research/sources.json) preserves source URLs, retrieved evidence and date limitations. Vendor documentation establishes described behavior only; plan availability, integration approval, performance and suitability are not independently verified.

Current code inspection found a portal Members CRM, athlete-grouped coach-family in-app threads and a member email action. Those are not proof of a shared SMS inbox or configurable workflow engine. Existing identity and membership records must remain authoritative. This design does not authorize continuing a coach communication path that leadership has not approved.

| Area | Verified reference baseline | Clubhouse classification | Deliberate boundary |
|---|---|---|---|
| Conversations | HighLevel Conversations; Front reply collision; Intercom assignment | Essential | Adult endpoint plus location sender, not an unrestricted family group chat. |
| Pipelines | HighLevel stages/opportunities; HubSpot conditional properties | Essential | Sample stages require approval; separate sibling/program deals are legitimate. |
| Workflows | HighLevel triggers/actions/waits/settings; Customer.io journey controls | Essential design, staged implementation | Full configurable editor contract, not a promise all nodes ship in foundation. |
| Tags/segments | Requested product scope; linked-record model informed by Attio | Essential | No claim every vendor supports identical entity-level tag semantics. |
| Summaries/reply drafts | Front Copilot, Intercom assistance, Attio summaries | Proposed assisted phase | Sources, permissions and human review; availability and data-use gates remain. |
| AI workflow drafting | HighLevel AI Builder | Later proposal | Draft diff plus simulation; unsupported operations must remain unsupported. |
| Corporate distribution | Proposed Clubhouse governance | Later proposal | Location adoption, not silent global rollout. Vendor equivalence unverified. |
| Conversational email | Gmail/Workspace integration option | Decision needed | OAuth, review, synchronization and volume limits require separate feasibility. |
| Bulk email/campaigns | Dedicated delivery service option | Later decision | Gmail is not an unlimited campaign engine; SendGrid is separate from Twilio SMS. |
| Voice, funnels, ads, stores | Broader commercial product surface | Unsupported in this scope | No implication of complete HighLevel replacement across all products. |
| AI autonomously merges/sends/charges | Not a Clubhouse requirement | Explicitly excluded | Cannot infer consent or override financial, guardian or tenant controls. |

Primary reference links:

- [HighLevel Conversations](https://help.gohighlevel.com/support/solutions/articles/155000006610-getting-started-with-the-conversations-tab)
- [HighLevel pipelines](https://help.gohighlevel.com/support/solutions/articles/155000005062-getting-started-setup-pipelines-and-opportunities)
- [HighLevel workflow settings](https://help.gohighlevel.com/support/solutions/articles/48001239875-workflow-settings-overview)
- [HighLevel wait action](https://help.gohighlevel.com/support/solutions/articles/155000002470-workflow-action-wait)
- [Front collision detection](https://help.front.com/en/articles/2403)
- [Attio linked-record model](https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views)
- [Customer.io entry controls](https://docs.customer.io/journeys/campaign-triggers/)
- [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) and [synchronization](https://developers.google.com/workspace/gmail/api/guides/sync)
- [SendGrid setup](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/api-getting-started)

Research dates describe the saved review, not a guarantee these products have been exhaustively compared or that their documentation will not change.

## 3. Screen map and interaction model

| Destination | Primary question | Connected actions |
|---|---|---|
| Overview | What needs staff attention now? | Needs reply, unassigned, due follow-ups, stalled deals and automation exceptions open their underlying record and reason. |
| Conversations | Who should reply, to which adult, from which location? | Search/saved queues, thread, assignment, escalation, notes, templates, schedule preview, takeover and family/opportunity context. |
| Contacts | Who belongs to this relationship? | Search/saved views, family/adult/athlete relationships, tags, consent evidence, conversion history and duplicate review. |
| Opportunities | What is the next step for this athlete/program? | Stage view/list, details, owner, next action, required fields, history and safe stage configuration. |
| Workflows | Why would this automation act, and can we safely activate it? | Library, visual editor, node settings, simulation, validation, version review, pause and run/failure inspection. |
| Tags & Audiences | What does this label mean and who is eligible? | Entity-specific library, manual/bulk edits, reference-aware rename/archive, dynamic include/exclude audience preview. |
| Templates | What approved wording/version should staff use? | Channel/purpose scope, variables, preview, version proposal and location adoption. |
| Reports | What happened and what needs investigation? | Human-response metrics, stage movement, run outcomes, delivery state and usage evidence. |
| Settings | Is this location authorized and ready to communicate? | Restricted role/connection/identity/health/consent-policy review. |
| Exceptions | What happens when the normal path is unsafe? | Reviewable failure-state gallery and recovery actions. |

Navigation preserves the selected location. Search results remain permission-scoped. Opening a contact from a thread keeps a route back to that thread; opening a deal preserves the adult and athlete context. A location switch clears incompatible selections, drafts and cached record context rather than rendering another location's history.

Desktop prioritizes simultaneous context and rapid operation. Phone prioritizes queue → thread → context, with a clear back path and reachable actions. Opportunities support stage selection/list movement with explicit confirmation, not drag-and-drop only. No core operation should require hover.

Keyboard: visible focus, meaningful control labels, logical order, Enter/Space activation, Escape to close dialogs, restored focus on close and errors associated with fields. Production acceptance must include screen-reader testing, contrast and reduced motion. The prototype is not an accessibility certification.

## 4. Identity, thread boundaries and conversion

| Concept | Meaning and invariant |
|---|---|
| Family | Shared household relationship, not automatic permission to see every adult's communications. |
| Adult/guardian | A canonical adult identity with explicit authorized athlete links and channel endpoints. Shared email/phone alone never proves identity or custody authority. |
| Athlete | Separate person/context; interests and program history do not automatically apply to siblings. Not a direct CRM messaging recipient. |
| Opportunity | A location-scoped athlete/program pursuit. A family can have multiple legitimate open opportunities. |
| Conversation | Authorized adult participants + location/business sender + channel endpoint identity. A family summary may reference allowed threads without merging private conversations. |
| Membership/payment | Authoritative operational source. CRM tags cannot redefine enrollment, arrears, consent or balances. |
| Prospect conversion | Link or create the canonical family/adult/athlete after review, retain original lead source, activity, assignments, tags and opportunity IDs, and record conversion actor/time. |

Duplicate suggestions explain matching evidence and conflicting relationships. Staff choose “keep separate,” “link existing after verification,” or request authorized review. No automatic merge by phone/email, no global merge outside a user's scope and no history deletion. Shared endpoints with uncertain adult ownership block sending until a verified recipient is chosen.

Attachments have type, size, scan/access policy and channel capability gates. SMS attachments are MMS only where sender/provider/registration supports them; unsupported files require another approved route with explicit user selection. Email capability is not assumed.

## 5. Proposed permissions and location scope

These are approval-ready recommendations, not permissions currently granted. Leadership must sign a resource × action × location matrix before write access. Existing auth uses owner/admin/coach/parent/super_admin with staff/instructor presets; **GM mapping is unresolved** and must not be implemented by renaming an existing role.

| Action | Owner, own approved locations | GM, assigned location | Instructor | Corporate |
|---|---|---|---|---|
| View family/contact context | Approved location scope | Approved operational scope | Assigned athlete and minimum guardian context | Aggregate/template scope by default; individual data needs explicit delegation. |
| Create/update prospect and deal | Proposed yes | Proposed yes | Refer a lead or assigned next step only, pending policy | No automatic cross-tenant editing. |
| Assign/escalate conversation | Proposed yes | Proposed yes | Escalate assigned work; reassign authority pending | Only where explicitly delegated. |
| Send to guardian | Only after channel/purpose permission | Same checks; approved role policy | D10 decision still required; default blocked | No broad corporate send permission by default. |
| Notes and mentions | Authorized operational notes | Authorized location notes | Assigned lesson/context notes only | No automatic access to private local notes. |
| Create/manage tags | Own location, approved categories | Proposed allowed categories | Apply approved tags only on assigned records, pending approval | Propose shared library versions, not mutate all local tags. |
| Bulk edits/export/audiences | Separate elevated permission and audit | Explicit grant, not implied | Not proposed | No cross-tenant export by default. |
| Workflow edit/publish | Edit; separate approver recommended | Edit; publication permission explicit | No publish | Propose versions; local adoption required. |
| Connect/disconnect channels | Restricted location administrator | Only explicit delegated permission | No | Managed-account administration only if chosen and approved. |
| Sensitive billing | Existing separately approved controls | Explicit financial authority only | Never | Explicit delegated scope only. |

Hiding controls is not enforcement. Future APIs/data policies must enforce scope before reading, writing, searching, exporting, simulating or retrieving AI context. Audit logs themselves must not expose inaccessible message bodies or billing.

## 6. Conversation behavior

Queues include needs reply, mine, unassigned, follow-up due and delivery attention. Unread is staff read state, not customer SMS read evidence. Each thread identifies recipient adult, linked athlete context, location sender, channel, assignee, consent purpose and last activity.

| Event/control | Proposed behavior |
|---|---|
| Reply | Preview resolved recipient and sender; preserve draft. Recheck identity, role, location, endpoint, purpose, consent, suppression, ownership and caps immediately before enqueue/send. |
| Internal note / mention | Visually distinct mode and history; never render in outbound message content or AI customer draft context unless explicitly permitted and safely transformed. Mention notifications remain staff-only. |
| Teammate composing | Informational presence; not a lock guarantee. A new message/assignment revision after drafting produces a stale warning and requires reread/review before send. |
| Assign / escalate | Single accountable owner plus optional team; record old/new owner and reason. Escalation creates a due next action. |
| Human takeover | Pause the relevant relationship/journey's outward automation under explicit scope; show what remains queued and when resumption requires review. |
| Schedule | Show recipient-local and location-local time, purpose, sender, quiet-hour/cap eligibility and queued policy. Future eligibility is not guaranteed by today's preview. |
| Incoming reply | Append provider event once, update queue/owner notification and evaluate reply-wait/human-handoff rules. An ambiguous shared endpoint goes to review, not an arbitrary adult. |
| AI draft | Editable proposal with source messages/timestamps and “last generated”; never sends itself and never overwrites a human draft without consent. |
| Failure | Preserve draft and explain blocked/delayed/failed/unknown. Do not mark a provider acceptance as delivered. |

SMS state vocabulary: draft → scheduled/queued → attempted → provider accepted → delivered, or blocked/skipped/failed/unknown. Out-of-order/duplicate provider events must not regress confirmed delivery; retain evidence and event timestamps. Delivery is not proof a guardian read the text.

Email is visibly optional/proposed. Calls and broad campaigns are later scope. Channel failure never silently changes provider, location sender or communication channel.

## 7. Tags, audiences and governance

Tags have stable identifiers, display name, category, optional color, description, entity type, location visibility and archived state. Membership, sport, consent and billing remain canonical fields rather than shadow truth in tags.

| Operation | Required behavior |
|---|---|
| Manual apply/remove | Choose family, adult or athlete explicitly. Record actor/time/source and only emit an event on a real state change. |
| Bulk edit | Requires separate permission. Preview affected entity count and samples, inaccessible exclusions and add/remove changes; confirm before execution. Partial failures must report per-record status in production. |
| Rename | Stable references survive. Preview dependent saved views, audiences and workflow versions; update display name, not meaning silently. |
| Archive | Prevent new use; show affected references and require replacement or explicit disabling/revalidation. Retain history; never silently break active audiences. |
| Workflow tag action | Idempotent add/remove; include source run and causal chain; prevent same-chain loops and duplicate enrollment. |
| Manual/workflow conflict | Proposed manual suppression/tombstone for that journey/version prevents immediate automated re-add until reviewed or an approved reset event occurs. Show override reason; final policy needs approval. |

Audience expressions support nested AND/OR groups, has/does-not-have, any/all tag sets and authoritative fields such as location or membership status. Tags belong to the selected entity: athlete interest resolves through verified guardian links; it does not copy to every family member.

Preview shows matched entities, eligible adults, excluded adults with reasons and endpoint-level deduplication. For example, two interested siblings may produce two athlete matches but one guardian camp-marketing message with approved combined context. A distinct appointment reminder remains separate when its appointment intent differs. Household collisions are keyed by approved communication intent and time window, not simply family ID.

Enrollment uses an auditable eligibility snapshot; live state is re-evaluated at execution. Removal of an inclusion tag or addition of an exclusion tag after scheduling can suppress the queued message. Tag changes never create consent.

**Example:** add “Interested in Summer Camp” to an athlete → approved tag-triggered journey checks adult eligibility → preview camp draft → wait for reply or booking → reply goes to staff; authoritative booking exits nurture → optional tag update. Wording, timing and scope remain proposals.

## 8. Opportunity contract

The clickable prototype uses this recommended sample pipeline: New inquiry → Needs follow-up → Evaluation booked → Proposal → Won. Leadership may choose separate Evaluated or Decision pending stages rather than using Proposal. Lost/disqualified is a status with a reason, not a history-deleting action. These names are not approved sales policy.

Each opportunity shows location, family, athlete/program, stage, open/won/lost status, assigned owner, proposed value/currency, next action/due date, source, linked threads and stage history. Value is a sales estimate, not a charge or recognized revenue.

| Transition/configuration | Validation and recovery |
|---|---|
| Evaluation booked | Require a real appointment reference or approved exception with reason. Changing a display stage alone cannot create a booking. |
| Evaluated / proposal preparation | Require completion evidence and next action as approved by leadership; exact stage mapping remains open. |
| Won | Link verified enrollment or mark pending reconciliation; do not invent membership or trigger a charge. |
| Lost/disqualified | Require approved reason; retain history and handle related journeys explicitly. |
| Move backward | Preserve timestamps/history and re-evaluate workflow re-entry; not automatic replay of all messages. |
| Remove a stage | Show affected open/closed counts, choose compatible destination, preview required-field conflicts, confirm migration and retain historic stage labels. Block deletion while unresolved. |

Multiple sibling/program deals may coexist. Warn about probable duplicates but never force all family opportunities into one record. Stage ordering and required fields are versioned configuration; changes cannot silently invalidate in-flight records.

## 9. Workflow editor and node catalog

The workflow workspace includes library, visual graph, node configuration, validation, side-effect-free simulation, version review and execution/failure history. It is a configurable builder, not a set of reminder switches.

| Node family | Supported design examples | Context/guard |
|---|---|---|
| Trigger | Lead created; stage changed; tag added/removed; booking created/rescheduled/cancelled/no-show; enrollment; attendance lapse; milestone; payment-date proximity; approved recurring schedule | Stable event ID and subject identity; one workflow version per run. Business-event availability must be confirmed during implementation. |
| Filter / branch | Entity tags any/all/not; location; membership; booking; guardian eligibility; reply state; approved fields | Distinguish athlete/adult/family/opportunity/appointment. Missing or inaccessible fields follow explicit “cannot determine” branch or block. |
| Wait | Duration; local date/time; before/after appointment; next approved recurring time | Timezone, quiet hours, missed-time and reschedule policy shown. |
| Reply wait | Inbound adult reply before timeout | Correlate endpoint, thread, location and run intent; reply exits outward nurture and routes staff per policy. |
| Message | Approved SMS; email only when authorized/configured | Resolve adult/sender/template/version and revalidate immediately before dispatch. |
| Internal action | Create/assign task; escalate; add private note; approved opportunity update | Role/location safe; never an automatic financial action. |
| Tag action | Add/remove existing allowed tag | Correct entity; real changes only; loop protection and audit. |
| Goal / exit | Booking, conversion, manual completion, reply, suppression or incompatible state | Observe authoritative events; cancel incompatible future actions without erasing history. |

The visual editor must expose node meaning, required fields, branch conditions, default/unknown path and validation state. Unsupported requested actions stay visibly unsupported. A graph with unreachable nodes, missing recipients, unbounded loops or unconfigured required channels cannot publish.

## 10. Workflow operating semantics

| Concern | Proposed contract |
|---|---|
| Enrollment identity | Run = location + workflow/version + context kind/ID + triggering event ID. Retried event delivery cannot create another run. |
| Re-entry | Explicit never / after completed / after approved cooldown. Concurrent runs for the same subject/intent are blocked by default; sibling appointment contexts remain distinct. Final intervals require approval. |
| Tag loops | No event for a no-op; record causal chain; disallow same-chain reflexive re-entry and enforce bounded transitions. Legitimate later manual changes remain distinguishable. |
| Eligibility | Entry snapshot explains why enrolled; each action checks current authoritative eligibility and approved exclusions. |
| Quiet hours | Use verified recipient timezone with location timezone displayed. Unknown timezone blocks or queues for manual review; never silently guesses a send time. |
| Caps | Enforce location-business + adult endpoint global cap and per-channel/purpose cap across all workflows/manual campaigns. Policy may exempt defined service messages only after approval. Counts, windows and exemptions are open. |
| Priority/collision | Staff reply/human takeover supersedes incompatible nurture. Related household sends deduplicate by intent; do not suppress distinct athlete appointments. |
| Missed time | Node-specific skip, move to next permitted window or staff review; never burst-send all overdue reminders after recovery. |
| Reschedule/date change | Recompute future relative waits from current authoritative appointment/payment date, cancel obsolete queued intent and explain old/new schedule. Never resend an already completed intent without explicit policy. |
| Recurrence | Explicit timezone, start/end boundaries, max/re-entry policy and overlap prevention. No infinite loop hidden in a recurring trigger. |
| Consent/opt-out | Execution-time channel/purpose/business-identity check. Incoming STOP or revocation suppresses queued affected sends, with a visible audit reason. |
| Lost connection | Pause affected dispatch; expose queue age and reconnect action. No silent sender/channel fallback. |
| Retry | Safe known failures use bounded retry/backoff only under documented idempotency. Unknown provider outcome goes to investigation/reconciliation; no “retry all.” |
| Audit | Explain event, recipient resolution, policy/version, branch inputs, schedule revisions, actor and provider evidence within permission scope. Redact sensitive values from general logs. |

### Simulation, publication and pausing

Simulation never calls a delivery provider, writes operational tags, creates real tasks or changes bookings. It displays sample/selected context, resolved adult and sender, filled template variables, both timezones, branch reasons, suppressed steps, tag effects and predicted timing. The prototype simulation is illustrative and is not a production policy evaluator.

Any future live test is a separate action with explicit warning, a staff-only allowlist, approved permission and real-send confirmation. It cannot be substituted silently for simulation.

Publication review shows validation results, previous/proposed version diff, approver role, assumptions, channel readiness, consent policy reference and treatment of current runs. Proposed default: existing runs remain pinned to their published version; only future entries use the new version. Migrating active runs requires explicit affected-run preview and approval. Disabling unsafe versions may cancel queued actions under an audited safety operation.

Pause offers distinct scopes: stop new enrollments; stop queued outward sends; both. State exactly whether internal tasks continue. Resumption rechecks timing, eligibility, caps and connection state; expired reminders do not flush in a burst.

Failure center distinguishes blocked, delayed, skipped, failed and unknown. Each item includes cause, safe next action, run/context/version, last evidence and permissions. Unknown delivery may be resolved only from authoritative reconciliation, not a staff guess disguised as provider proof.

### Reevaluation rule

Create an internal staff reevaluation task only when there is an upcoming visit and the next payment is within ten days. Re-evaluate on relevant visit/payment-date changes and continue appropriate reminders until the task is completed. Do not substitute a thirty-day cycle. Do not automatically contact the parent or change billing. A missing visit or payment date does not satisfy the condition. Leadership must approve the exact treatment of overdue payments, due-today boundaries and “upcoming” before execution.

## 11. SMS and email connection design

Each location has its own Twilio connector and sender identity. This implements the creator's proposed direction, not provisioning approval.

| Setting | Required design/implementation gate |
|---|---|
| Account model | Decide independent location-owned accounts versus centrally managed subaccounts. A connector alone does not settle this. |
| Ownership | Record legal/business sender, number ownership, billing responsibility, administrator, portability and offboarding/revocation process. |
| SMS readiness | Connection health, assigned number, registration/review state where applicable, approved use case, consent source, delivery callbacks and opt-out handling. |
| Connection actions | Secure server-mediated Connect/Reconnect/Disconnect; no raw credential fields in browser/chats, no tokens in client bundles. Prototype only simulates. |
| Disconnect | Show affected queued sends/workflows; pause them, preserve audit and explain reconnect/offboarding. Never transfer to another location automatically. |
| Usage | Counts/segments/provider outcomes, data freshness and budget thresholds. Show no invented per-message price or guaranteed delivery. |

Twilio SMS is not SendGrid email. If SendGrid is chosen it needs separate account/domain/sender onboarding and policy. The existing system-notification sender is not replaced by this design.

### Optional Gmail / Google Workspace

Recommend a business-owned location mailbox, subject to approval; not an employee's private mailbox. Connect through explicit OAuth, never mailbox passwords. Explain requested scopes and authorized mailbox. A label or application filter may constrain what Clubhouse processes but does not narrow the OAuth grant itself.

Define synchronization scope before connection: new-only versus approved bounded history, permitted threads, initial cursor and history resync behavior. Track mailbox/provider message/thread identifiers, processed events and outbound identities to deduplicate inbound, outbound and messages sent outside Clubhouse. Reply threading follows provider identifiers plus allowed adult/location context; subject lines alone do not authorize linking.

Expose last successful sync, delayed sync, revoked grant, reconnect and partial-history limitations. Revocation pauses email actions; it cannot silently route via SMS or another mailbox. Reconnect requires deliberate history/resync scope; stale cursors may require a bounded full resync with user-visible explanation.

Google sensitive/restricted scopes, OAuth verification and any applicable security assessment, Workspace administrator controls and data-use/AI restrictions must be assessed before a launch date or AI access is promised. No complete mailbox synchronization by default. Connected email is initially a correspondence proposal; bulk campaigns, transactional delivery and volume limits need a separate approved route and explicit queues.

## 12. AI draft, approve and execute powers

| Operation | AI may propose | Human/approved system responsibility |
|---|---|---|
| Thread summary | Permission-scoped summary with source messages, timestamps and freshness | Review gaps; retrieve only authorized sources, never reveal another adult's private thread. |
| Reply | Editable grounded draft; explain assumptions | Staff selects recipient/sender/purpose, reviews and explicitly sends under normal policy. |
| Workflow draft | Node/condition/template change proposal, assumptions, unsupported requests and version diff | Authorized editor validates and simulates; authorized approver publishes. |
| Record linking | Suggest possible duplicate with evidence | Authorized human verifies identity; no AI merge. |
| Consent, billing, permissions | Explain existing accessible facts | AI cannot infer consent, change finances, grant access or override policies. |

Source timestamps must be visible; a stale source flags the draft. Insufficient evidence should return a limited draft or abstain, not invent family facts. AI unavailable leaves the manual composer/editor operational. Rejected approval keeps the proposal separate from the published version. Customer content is untrusted input, not instructions that can change tools or permissions.

AI launch placement and mailbox data use remain open. The prototype uses fixed sample proposals, not a live model.

## 13. Corporate templates and workflow rollout

Corporate authors a versioned proposal with change summary, scope, minimum required controls and local override policy. Locations compare their current version and overrides, simulate against their allowed context, accept or decline with reason and activate only with local authority. Report adoption status without broad customer-record access.

An edit to a shared template must not silently change a published local workflow's wording. Published runs pin template/policy references. An emergency compliance restriction may require a separately approved audited safety process; it is not a general corporate cross-tenant editing privilege.

## 14. Reports and trust

All prototype numbers are synthetic examples, not historical performance. Do not claim automation caused revenue growth.

| Measure | Definition and caution |
|---|---|
| First human response | Elapsed time from eligible inbound adult message to first staff reply, with business-hours treatment and denominator shown. Automated acknowledgments reported separately. |
| Queue age | Time since eligible inbound/unassigned/due event, with clock/timezone and exclusion rules. |
| Stage conversion | Cohort/time window and denominator visible; distinguish stage moves, won opportunities and verified membership enrollment. |
| Delivery outcomes | Queued, attempted, provider accepted, delivered, failed, unknown and suppressed separately. Counts have a reporting cutoff; asynchronous states need reconciliation. |
| Workflow outcomes | Entered, active, exited by goal, blocked, delayed, skipped, failed and unknown. Not proof of causation. |
| Usage/budget | Channel counts and SMS segments where available, provider-reported cost only when real and dated. No invented tariff. |

SMS does not supply ordinary “read” receipts. Email open tracking, if ever approved, is separate and unreliable as evidence of a person reading. Billing visibility follows financial privileges, not CRM report access.

## 15. Exceptions and recovery

| State | What staff sees | Safe next action |
|---|---|---|
| Empty | No conversations/records in this approved scope | Adjust filters or create an allowed prospect; do not fabricate populated results. |
| Unconfigured channel | No authorized sender; sends blocked | Restricted administrator reviews connection setup. |
| Forbidden | Action unavailable for this role/location | Request approved access; do not reveal inaccessible contact details. |
| Opted out while queued | Message suppressed with policy reason | Update internal task; only resume after valid, recorded new permission under approved policy. |
| Ambiguous guardian/shared phone | Recipient identity unresolved | Verify adult/athlete relationship before communication. |
| Offline draft | Local draft unsent; connectivity stale | Preserve securely within approved retention, reconnect, reread thread and revalidate. Prototype is ephemeral. |
| Stale ownership/reply | Assignment or last-message revision changed | Preserve draft, review new state, take over only if authorized. |
| Rescheduled visit | Old reminder cancelled; new schedule explained | Check current visit and next eligible window. |
| Duplicate trigger | Event already processed | Open original run; do not enroll again. |
| Unknown send | Provider may have accepted; outcome uncertain | Reconcile provider evidence; do not blindly retry. |
| AI unavailable/stale/insufficient evidence | Draft cannot be trusted or generated | Continue manually or refresh authorized sources; no automatic send. |
| Approval rejected | Proposed version remains inactive | Revise proposal and simulate; current published version unchanged. |

## 16. Leadership approval register

All entries below are **open recommendations** unless explicitly described as creator direction. Approvers are accountable role suggestions, not invented named people. Approval of the design does not itself approve real sending, data access or a provider contract.

| Decision | Proposed approver | Proposal / question |
|---|---|---|
| D01 operating scope | Product owner + operations leadership | Approve navigation, first implementation slice and essential/later matrix. |
| D02 channel ownership | Franchise/business owner + corporate operations | Twilio per location is creator direction. Choose account model, number ownership/billing/offboarding and email route. |
| D03 communication policy | Legal/privacy lead + business owner | Approve consent purposes/evidence, opt-out handling, quiet hours, caps, minors/guardians and required notices. No compliance guarantee from this design. |
| D04 data governance | Privacy/security lead + operations | Retention, deletion/legal hold, attachment controls, exports, migration source and mailbox history scope. No invented period. |
| D05 pipeline | Sales/operations lead | Approve stages, required fields, lost reasons, estimates and conversion evidence. |
| D06 workflow operation | Operations owner + authorized approver | Re-entry/cooldowns, caps, pause semantics, manual tag conflicts, recurring boundaries, timeouts and in-flight changes. |
| D07 AI | Product owner + privacy/security lead | Launch coverage, data use, permitted sources and draft/publish authority. |
| D08 corporate rollout | Franchise leadership + location owner | Local adoption/override powers and any separately governed emergency safety process. |
| D09 roles and locations | Operations leadership + security owner | Signed resource/action/location matrix; resolve GM auth mapping and corporate scope. |
| D10 instructor communication | Leadership + privacy/legal lead | Whether and which instructors may contact guardians. Direct athlete messaging remains excluded. |
| D11 reevaluation boundary | Operations/finance lead | Preserve upcoming visit + next payment within ten days, repeated until complete; clarify boundary cases without automatic outreach. |

Before production: channel onboarding/registration, Google scope feasibility, authorization, suppression, deduplication, queues, idempotency, retention and audit controls require implementation and verification. Regulatory/provider policies may vary by geography, use case and account. Obtain qualified review; UI controls are not legal certification.

## 17. Implementation handoff

The existing native CRM foundation task covers canonical records, prospects, opportunities, assigned follow-ups, audit and approved access. It excludes provider setup/live sends and does not promise a complete workflow execution engine. Do not silently expand it or introduce duplicate family/member sources.

Recommended gated sequence:

1. Leadership signs screen/identity/permission/pipeline decisions. Reconcile existing coach-message tasks with D10. Inventory authoritative events and records.
2. Deliver approved CRM foundation with server/data enforcement, no live communications. Reconcile this design's tags and audiences explicitly into approved scope rather than assuming coverage.
3. Implement location SMS connections and provider-neutral delivery/receipt handling only after ownership, channel and consent decisions. Keep system email separate.
4. Implement workflow runtime/editor/simulation/versioning with authoritative events, execution-time suppression, safe retries and failure operations. This is a separate subsystem, not a scheduler checkbox.
5. Assess optional Gmail/Workspace and dedicated email route independently; add sync and correspondence only after feasibility/privacy approval.
6. Add sourced AI and corporate distribution by approved phase, with permission and adoption controls.

No step authorizes the next automatically. The design's mock role switches, simulated sends, sample reports and visual graph are not substitutes for backend authorization, a delivery engine, actual provider health or real historical data.

## 18. How to review and accept

Use the connected canvas prototype and the [scenario checklist](scenario-review.md). Review conversations and family routing first, then tags/audiences, opportunity stages, workflow simulation/publication, connection settings and exceptions on desktop and phone.

Leadership can accept the design direction while leaving decisions open. Record which screens/behaviors are accepted and which policy register entries remain blocked. Only after that should implementation tasks be updated or enabled.

Prototype boundary: the visual editor supports typed-node changes and derived review previews, not arbitrary edge wiring or real execution. The computed audience demonstrates one AND/OR group; nested rule groups are specified for the production design. Durable tag IDs, full audit/event processing and execution-time enforcement are contract requirements, not a production schema or engine implemented by the mockup.
