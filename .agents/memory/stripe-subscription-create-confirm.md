---
name: Subscription.create off_session does not confirm the invoice PaymentIntent
description: Passing off_session to Subscription.create is a no-op for confirmation; the resulting invoice PaymentIntent can be left in requires_confirmation forever.
---

Passing `off_session: true` (or any `off_session` param) directly to `Subscription.create`
does not confirm the first invoice's PaymentIntent — that field isn't part of the
subscription-create payload's confirmation behavior. If the customer has a saved default
payment method, Stripe creates the PaymentIntent but leaves it in
`requires_confirmation`, so the subscription and invoice sit unpaid indefinitely with no
error surfaced to the caller.

**Why:** found via real end-to-end validation — a brand-new subscription created through the
app's real code path never activated; `payment_intents/{id}` showed
`status=requires_confirmation` while the calling code assumed `off_session` handled it.

**How to apply:** after `Subscription.create`, check
`latest_invoice.payment_intent.status`; if `requires_confirmation`, explicitly call
`POST /v1/payment_intents/{id}/confirm` before returning success to the client.
