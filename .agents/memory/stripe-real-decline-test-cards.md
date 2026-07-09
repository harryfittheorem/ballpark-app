---
name: Real Stripe test-decline cards for E2E testing
description: Which Stripe test tokens actually let you save a card and then get a genuine decline on charge (vs failing immediately at attach).
---

When a task requires a *real* Stripe-originated decline (not a hand-crafted synthetic
webhook event) to validate payment-failure recovery logic end-to-end:

- `tok_chargeDeclined`, `tok_chargeDeclinedInsufficientFunds`, `tok_chargeDeclinedExpiredCard`,
  `tok_chargeDeclinedProcessingError` all fail immediately at `payment_methods/{id}/attach`
  — Stripe validates the card synchronously on attach, so these can never be saved as a
  customer's default payment method. This happens on both connected accounts and the
  platform account, regardless of capability status.
- `tok_chargeDeclinedFraudulent` is different: attach succeeds (card saves normally, like
  a real "add card" flow), and the decline only happens on the actual charge attempt
  (`invoices/{id}/pay` or subscription creation). This is the one to use for simulating
  "card was fine, then a renewal payment genuinely failed."
- Raw card numbers (e.g. the well-known `4000000000000341` "attach succeeds, later charges
  fail" test card) are blocked by Stripe's raw-card-data API restriction on Connect
  platforms by default — only named tokens/PaymentMethod IDs work without enabling that
  feature via Stripe support.
- On a connected account without an active `card_payments` capability, even
  `tok_chargeDeclinedFraudulent` will eventually hit a hard capability-level block
  ("Your account cannot currently make charges...") on repeat attempts — the first charge
  attempt can still produce a genuine fraudulent decline and a real `invoice.payment_failed`
  event, but you can't reliably chain multiple real declines on the same under-provisioned
  account. Real capability (Express onboarding + identity verification) is required for a
  fully repeatable real-decline test.
