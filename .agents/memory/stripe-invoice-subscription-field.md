---
name: Stripe invoice subscription field moved (API version drift)
description: Newer Stripe API versions move invoice.subscription to invoice.parent.subscription_details.subscription; synthetic test payloads can mask this.
---

Stripe accounts on newer API versions (observed: `2026-04-22.dahlia`) no longer populate
the top-level `invoice.subscription` field on `invoice.*` webhook events. The linked
subscription id now lives at `invoice.parent.subscription_details.subscription`.

**Why:** discovered via a real (not synthetic) Stripe test-decline charge on a connected
account — the real event silently failed our `!invoice.subscription` guard and returned
`{ok:true, ignored:true}`, so no DB update happened despite a genuine decline. A
hand-crafted synthetic webhook payload had used the old field shape and never exercised
this path, masking the bug.

**How to apply:** any code reading `invoice.subscription` from a webhook payload must
also check `invoice.parent?.subscription_details?.subscription` (or better, read whichever
is present) — don't assume the API version used for docs/tests matches what the connected
account's live events actually send. `supabase/functions/stripe-webhook/index.ts` has an
`extractInvoiceSubscriptionId()` helper for this now; reuse it for any new invoice-linked
subscription handling.
