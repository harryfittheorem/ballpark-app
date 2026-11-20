# CRM scenario review

**Design acceptance checklist, not evidence that production flows exist.**

All names, messages, roles and counts in the prototype are examples. Local actions reset on refresh. Use the specification for the complete operating contract; visual simulations intentionally do not deliver messages or evaluate production policies.

## Walkthroughs

| Scenario | Review path | Expected design outcome |
|---|---|---|
| New inquiry to evaluation | Overview → Conversations → family → Opportunity → Workflows | A named adult receives an explicitly previewed location reply; one owner and next step remain visible; booking uses authoritative appointment context. |
| Evaluation cancelled/no-show | Opportunity → workflow wait/branch → run explanation | Cancelled booking exits incompatible reminders; no-show creates approved recovery/task proposal rather than treating all failures as new leads. |
| Two siblings, one guardian | Contacts → athlete interest tags → audience preview | Distinct athlete interests/deals survive; one eligible adult may receive combined camp outreach; separate visit intents remain separate. |
| Two guardians with private threads | Contacts → Conversations | Family context does not merge one adult's private conversation into another adult's outbound thread. |
| Shared phone, ambiguous adult | Exceptions → ambiguous guardian | Send is blocked; staff verify identity and relationship rather than selecting the first matching phone. |
| Prospect conversion | Contacts → conversion/linked history | Canonical identity and original activity are preserved; possible duplicate suggestions require human verification. |
| Manual tag | Contacts → correct entity → tag picker | Add/remove affects only selected entity; change has actor/source and never grants consent. |
| Workflow tag | Workflows → tag trigger/action → simulation | A real change can enroll; no-op add creates no event; same-chain loop/re-entry is prevented. |
| Tag rename/archive | Tags → manage → reference review | Stable references survive rename; archive explains affected audiences/versions and does not silently invalidate live runs. |
| Bulk edit | Tags/Contacts → select → preview → confirm | Permission, affected count and entity samples precede the simulated change. |
| Combined audience | Audience builder → AND/OR + has/not/any/all + membership/location | Included/excluded eligible adult preview explains guardian deduplication and opt-outs; canonical membership is a field, not a tag. |
| Manual removal versus workflow | Workflow settings → policy review | Staff can understand whether and why a workflow may re-add a tag; proposed override policy is explicitly pending approval. |
| Multiple deals | Opportunities → sibling/program details | Multiple legitimate pursuits are visible; one family's new deal does not overwrite a sibling's existing deal. |
| Stage move without evidence | Opportunity → advance stage | Required fields/evidence are requested; stage movement does not create a booking or charge. |
| Remove a stage | Pipeline configuration → destination preview | Affected records and validation conflicts appear; no deletion without safe migration. |
| Onboarding/milestone | Workflow library → sample journey → simulation | Milestone/authoritative event, selected context, task/message guard and goal exit are explained. |
| Attendance lapse | Workflow branch → internal next step | Policy/caps/human takeover are visible; no unapproved repeated outreach. |
| Reevaluation | Overview/task example → workflow contract | Upcoming visit and next payment within ten days create an internal repeating-until-complete staff task, not parent outreach. |
| Scheduled recipient opts out | Simulation/Exceptions → opt-out | Entry eligibility does not override execution-time suppression. |
| Appointment rescheduled | Wait configuration → exception/run reason | Old queued intent cancelled/recomputed; show both timezones and new permitted window. |
| Two staff reply | Conversations → presence/stale-draft review | Draft preserved; later message/ownership revision requires review, not blind simultaneous send. |
| Human takes over | Conversations → takeover → workflow pause | Affected nurture and queued outward sends are clear; internal task continuation is explicit. |
| Wrong location/role | Role/location preview → restricted action | No inaccessible sample thread is exposed; UI recommendation is not claimed as production security. |
| Unknown delivery | Failure center → investigate | No blind retry or invented delivery/read receipt. |
| No timezone | Workflow timing → validation | Do not guess recipient time; explain block/manual review. |
| Offline | Exception gallery → offline draft | Preserve unsent draft and require current thread/permission/consent checks on reconnect. |
| Disconnected Twilio | Settings → disconnect preview | Explicit location queue impact; no alternate-number/provider fallback. |
| Optional Gmail | Settings → OAuth/sync proposal | Email remains proposed; explain mailbox scope, history, reconnect and outside-app reconciliation. |
| Publish a workflow | Editor → simulate → validation → version review | Diff, approver, assumptions and active-run treatment precede simulated activation. |
| Pause and resume | Workflow → pause scope → review | New enrollment and queued sends are distinct controls; no overdue burst on resume. |
| AI unsupported request | AI workflow proposal → assumptions | Unsupported action stays unsupported; edit and simulation do not bypass approval. |
| AI stale/unavailable/rejected | Exceptions → AI states | Manual work still functions; proposed draft/version never auto-sends or auto-publishes. |
| Corporate update | Template/workflow proposal → local comparison | Location accepts/declines with override visibility; no silent global change or cross-tenant customer access. |
| Phone operation | Phone frame → Conversations/Opportunities | Queue/thread/back navigation and stage controls work without hover or drag-only actions. |

## Accessibility review targets for implementation

- Keyboard reaches navigation, search, thread selection, composer, node controls and modal actions.
- Dialogs have titles, focus containment, Escape dismissal and return focus.
- Errors are linked to fields; warnings are not color-only; text is readable at phone width.
- Stages can be moved without drag-and-drop. Tap targets remain separated.
- Reduced-motion preference, contrast, zoom and screen readers require production review.
- Private notes cannot be mistaken for outward messages. “Simulated” is persistent.

## Approval recording

For each row leadership may record accepted / changes requested / blocked by decision, along with a responsible role and comment. Acceptance here is design acceptance, not evidence of server-side enforcement or consent to contact customers.

## Verification record

Completed checks for this design delivery:

- Sandbox TypeScript check passed: `npm --prefix artifacts/mockup-sandbox run typecheck`.
- Sandbox production build passed with its configured `/__mockup/` base path. Existing unrelated sandbox previews remained in the build.
- The existing component-preview workflow was restarted successfully and served the new prototype.
- Screenshots rendered without runtime console errors: desktop Conversations and Workflows at 1440×960; phone Conversations and Opportunities at 390×844.
- The phone conversation was checked again after the final responsive correction: simulation/location controls and the reply composer, scheduling and simulated-send controls were visible above the bottom navigation.
- Source review checked location/role filters, consent-blocked local sends, tag/audience computations, editable workflow previews, validation and per-location simulated connection state.
- Final review found and corrected two parent/child property mismatches affecting workflow selection and audience AND/OR. Both component contracts are now typed rather than accepting arbitrary properties.
- Targeted component interaction tests passed through the actual workbench: select/edit/change timing/delete an SMS node and a wait node without changing the trigger; select the Trial tag and switch AND → OR → AND, verifying that eligible matching adults change correctly while cross-location and opted-out adults remain excluded. These tests invoke rendered controls without a browser or live services.
- Repeat the regression checks with `npm --prefix artifacts/mockup-sandbox run test:crm`.
- Standalone document validation found 45 unique anchors, no broken internal links and no required external assets or scripts. Research source hyperlinks remain intentionally external.

No end-to-end browser interaction suite, screen-reader certification, production authorization test, real SMS/email send, provider connection, live AI call or automation run was performed. Scenario rows above are leadership review targets, not a falsely completed test log.
