# Infinite Hitting migration meeting pack

Prepared 12 November 2026. Documentation only: no exports, private customer records, vendor contacts, payments, subscriptions or application behavior were changed.

## Share with owners

- [Five-slide presentation](presentation.html) — concise owner deck with keyboard navigation and five-page landscape printing.
- [Presentation notes and source references](PRESENTATION-NOTES.md) — talk track and documented migration examples, kept outside the five slides.

The presentation is also delivered as `generated-artifacts/migration-meeting/infinite-hitting-migration-slides.pdf` (five 16:9 landscape pages). Open `presentation.html` locally for arrow-key navigation, or print it to recreate the PDF. The original pitch deck and unrelated Mockup Sandbox are unchanged.

- [Owner briefing](OWNER-BRIEFING.md) — decision, evidence, inventory, schedule, responsibilities, risks and FAQ.
- [Short meeting summary](MEETING-SUMMARY.md) — concise leave-behind, not minutes of a meeting that has happened.
- [Agenda and talk track](MEETING-AGENDA.md) — 45-minute discussion and approval record.
- [Operations workbook](OPERATIONS-WORKBOOK.md) — vendor request drafts, acceptance checklist, reconciliation and cutover/contingency procedures.

## Internal use

- [Technical evidence and readiness backlog](TECHNICAL-APPENDIX.md) — current code references, documented test limits and links to existing work.
- [Charging-authority register](charging-authority-register.csv) and [financial reconciliation](financial-reconciliation.csv) — empty templates, not populated customer records. Instructions are in the workbook. Store populated copies only in approved restricted storage, not Git or this workspace.

## Downloadable editions

Run `python docs/migration-meeting/build-pack.py` from the repository root. It creates a self-contained, print-friendly owner HTML pack, a short HTML summary, and a separate internal appendix under `generated-artifacts/migration-meeting/`. Open an HTML file in a browser and use Print → Save as PDF if a PDF is needed. No network resources, analytics or external fonts are embedded. CSV templates can be opened directly in a spreadsheet.

The owner pack includes the operations workbook and meeting agenda; it intentionally excludes the internal technical appendix. Markdown sources remain the editable record. Official references and access limitations are recorded in the briefing. Published guidance is not account-specific vendor approval.

The presentation reflects the requested **planned HitTrax removal**. It does not implement that removal or claim it is finished. Rewards are presented as a retention opportunity, not a proven retention lift. Its migration examples describe published HubSpot and Stripe approaches, not invented customer case studies.

The updated roadmap proposes approximately two weeks of stabilization, evidence-based internal testing, an owner/staff trial, roughly one week of non-collecting shadow comparison with Mindbody, and a separate approval for a small Clearwater cutover. These are proposed stages, not work already performed or a guaranteed completion date. Mindbody remains authoritative throughout shadow testing; a comparison week does not establish a full billing-cycle result.
