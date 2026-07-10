---
name: invoice.period_end is stale on renewal invoices; use invoice.lines period
description: For subscription renewal invoices, top-level invoice.period_end reflects the period that just elapsed, not the new period being billed.
---

On a subscription renewal invoice, `invoice.period_end` (top-level field) is the end of the
period that just elapsed — the one the invoice is billing for — not the new upcoming period.
Using it to set something like `next_billing_at` after a successful payment silently sets the
wrong date (effectively a no-op or a step behind).

**Why:** found via real webhook replay validation — after a renewal payment succeeded, the
membership's `next_billing_at` wasn't advancing to the correct next date because the handler
read `invoice.period_end` directly.

**How to apply:** to get the *next* billing date, read `invoice.lines.data[0].period.end`
instead (the line item's period reflects what was actually billed and rolls forward
correctly). Applies to any `invoice.payment_succeeded` handler computing a forward-looking
billing date.
