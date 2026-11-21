---
name: Trainual export reconciliation
description: Why the original JSON and companion Markdown must be reconciled together.
---

The supplied Trainual JSON merges tests into preceding lesson bodies and substitutes survey URLs for four lesson URLs. Do not assume every exported step URL is a true lesson identity or that test metadata is a separate JSON entity.

**Why:** A URL-only adapter rejected valid source material; treating the merged text as a scored quiz would invent unavailable answer keys.

**How to apply:** Preserve originals, reconcile with companion Markdown, flag ambiguous identities, and keep source tests ungraded until authorized answer-key review. Export counts do not prove a complete live-account backup.
