---
name: Initial OTC payment missing from payment_events
description: attach-payment route activated memberships on PaymentIntent success but never inserted a payment_events row for the captured charge.
---

`portal/app/api/owner/enroll/attach-payment/route.ts` handled the OTC (PaymentIntent)
success path by activating the membership (and, for split payments, calling the
`activate_membership_with_scheduled_charge` RPC) — but never inserted a row into
`payment_events` for the deposit/full amount that was just captured on Stripe.

**Why this mattered:** `payment_events` is the single source of truth several owner
portal surfaces read from — monthly revenue, MRR, billing KPI cards, and the family's
payment-history timeline all filter on `payment_events.status='paid'`. Only
`collect-scheduled-charges` (the cron for later balance/deferred charges) was writing
`payment_events` rows, so every membership's very first payment was invisible in all of
those reports even though the money was actually collected on Stripe and the membership
was active.

**How to apply:** whenever a code path calls Stripe to capture a payment for a
membership/order, verify a matching `payment_events` (or equivalent ledger) row is
written in the same request — don't assume a downstream cron/webhook will backfill it.
Fixed by inserting a `payment_events` row (status='paid', payment_method='card',
stripe_payment_intent_id=stripe_intent_id) right after OTC membership activation in
`attach-payment/route.ts`, for both the split-deposit and full-payment cases.
