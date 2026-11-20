---
name: Portal route compatibility
description: Why the dashboard-named URL is intentionally still Today and player names must not be used to resolve links.
---

Preserve the historical Today destination at the dashboard-named owner URL, even though Dashboard is the owner landing view.

**Why:** The original portal exposed Today at that URL while the actual Dashboard lived at the owner root. Correcting labels by swapping their contents would silently change existing bookmarks and links.

**How to apply:** Change explicit landing redirects and navigation entries together. Do not repurpose the historical Today endpoint without a deliberate compatibility plan.

Player identity must come from a verified athlete/membership relationship, never a name match or an arbitrary child from a family.

**Why:** A player can have multiple memberships, two players can share a name, and legacy payment/order records may not identify an athlete reliably.

**How to apply:** Keep one athlete-level profile entry point, preserve selected membership context for history, and show unavailable for records without reliable identity rather than guessing.

Selecting a different membership must establish a fresh editing context, not just replace the displayed member data.

**Why:** Query-only client navigation can retain nested form state. An old session balance can then remain in an editor while its save handler targets the newly selected membership.

**How to apply:** Reset the entire membership-specific detail subtree when selection changes. Cover package switching with a mounted client-side test that checks both the displayed balance and the outgoing membership ID, not only static rendering.
