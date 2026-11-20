# Native CRM design review

**Status: proposed design for leadership review. Not production functionality or authorization to send.**

This is the discoverable entry point for the CRM design package. It is separate from the earlier migration meeting pack and leadership requirements consolidation.

## Open these first

1. **[Leadership design specification](specification.html)** — downloadable, self-contained document with the screen map, permissions, workflow contract, feature matrix and approval register.
2. **[Scenario review checklist](scenario-review.md)** — example journeys and expected safe outcomes.
3. **[Research scope review](../../research/crm-scope-review.html)** — the previously prepared comparison and primary sources. Vendor references describe documented capabilities, not complete parity or a market ranking.

## Clickable prototype

Open the **Mockup Sandbox** artifact on the canvas:

- **Clubhouse CRM · Interactive desktop design**
- **Clubhouse CRM · Staff phone design**

Both frames run the same responsive, connected prototype. Start in Conversations, then use the CRM navigation to inspect contacts, opportunities, tags/audiences and the visual workflow editor. The workflow editor can also be opened through the preview's `?view=workflows` query.

Prototype entry: `artifacts/mockup-sandbox/src/components/mockups/clubhouse-crm/CRMWorkbench.tsx`.

The prototype uses fictional families, roles, provider states and metrics. Actions are simulated in the browser and reset on refresh. No Twilio account, Gmail mailbox, live message, customer record, database or production permission is changed. Demo role restrictions communicate the proposal; they are not security enforcement.

## Review order

1. Follow a parent reply through Conversations and the family context.
2. Add an athlete interest tag; inspect the eligible-adult audience and exclusion reasons.
3. Open an opportunity; inspect stage requirements and history.
4. Edit and simulate the sample workflow; inspect publication, pause and failures.
5. Review Settings for location SMS, optional Gmail and separate email-service setup.
6. Review exceptions, phone operation and the approval register.

The design specification is authoritative about proposed behavior. The interactive prototype illustrates that contract; it is not an implementation of an automation engine. See the final verification section in the scenario checklist for the actual checks performed.

### Prototype boundaries

- The visual builder demonstrates adding, selecting, editing and removing typed nodes, timing settings, derived previews and version review. It does not execute workflows or implement arbitrary graph-edge wiring.
- The audience preview computes one AND/OR group with multi-tag, membership and location conditions over sample records. The specification also describes nested groups for the production design.
- Connection health, consent, permissions, AI proposals, delivery outcomes, template adoption and reporting are explicitly synthetic demonstrations, not external evidence.
- Durable tag identifiers, full audit history, authoritative event handling and every execution-time safety check are requirements in the contract, not a production data model hidden behind the mockup.

## Maintenance

Source document: [specification.md](specification.md).

Rebuild the standalone HTML after source edits:

```sh
python scripts/render-crm-design.py
```

Targeted interaction regressions:

```sh
npm --prefix artifacts/mockup-sandbox run test:crm
npm --prefix artifacts/mockup-sandbox run typecheck
```

No production CRM work is authorized by this package. The existing CRM foundation task remains narrower; future providers, live delivery and workflow execution need separate approved scope.
