---
name: Testing payment webhook logic without real Stripe capability
description: How to validate an app's decline/dunning/recovery logic when the connected Stripe account can't actually process real card charges.
---

When a Stripe Connect account's `card_payments` capability isn't active (see
stripe-capability-vs-charges-enabled.md), no real charge success/decline can be
generated on it. Chasing real capability activation (identity verification,
KYC documents) just to test *our own* webhook-handling code is a waste of
effort and requires faking real identity data.

**Why:** The actual thing under test in payment-failure recovery flows is our
own webhook handler's business logic (retry counting, escalation emails,
pause scheduling, idempotency, reactivation) — not Stripe's fraud/KYC
pipeline. That logic only depends on receiving a correctly-shaped, correctly-
signed webhook event; it does not care whether the event originated from a
real charge.

**How to apply:** Build an isolated DB fixture (family/kid/membership with a
fabricated `stripe_subscription_id`), then POST a hand-crafted event body to
the webhook endpoint with a valid `Stripe-Signature` header computed via
HMAC-SHA256 (`t=<unix_ts>,v1=<hex hmac of "{ts}.{raw_body}" using the webhook
signing secret>`). This exercises the exact same code path a real Stripe
delivery would, including idempotency and replay-window checks. Always clean
up the fixture (and any auth user created) afterward and verify zero residue.
