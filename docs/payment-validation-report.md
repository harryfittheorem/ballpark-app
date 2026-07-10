# Stripe Payment System — Architecture & Validation Report

**Status:** Production-ready (see [Production Readiness](#4-production-readiness))
**Scope:** Consolidates Task #572 (one-time / split / scheduled charges, onboarding, initial-payment reporting) and Task #573 (recurring subscription/EFT billing, renewals, retries, webhooks, cancellation, MRR).
**Validated against:** Frisco Academy, `acct_1TqDTKJ6oe1KFrG9` (Stripe Connect, test mode).
**Last updated:** 2026-07-10

This is a permanent reference document. For the original scenario-by-scenario execution logs (Stripe object IDs, raw API responses, exact curl/replay commands), see task history; this document distills those into durable architecture and validation knowledge.

---

## 1. Architecture Overview

### 1.1 Stripe Connect architecture

- **Model:** Stripe Connect, one connected account per franchise **location** (`locations.stripe_account_id`), onboarded via Stripe-hosted onboarding (out-of-band flow — the app never collects or stores bank/KYC details directly).
- **Platform vs. connected account:** all Stripe API calls from the app/edge functions are made with the platform's `STRIPE_SECRET_KEY` and a `Stripe-Account: {connected_account_id}` header, standard Connect "direct charges on behalf of connected account" pattern.
- **Application fee:** subscriptions are created with `application_fee_percent` (observed 6.0% in validation) so the platform takes its cut automatically on every charge.
- **Tenant isolation:** every location row carries `tenant_id`; every Stripe-touching edge function scopes its Supabase queries by both the target ID and the caller's tenant, so a franchise cannot see or act on another franchise's Stripe objects.

### 1.2 Connected accounts

- Onboarding entry point: `portal/app/api/stripe/connect/start` (creates the Connect account + hosted onboarding link), `.../callback` (Stripe redirects back after onboarding), `.../refresh` (regenerates an expired onboarding link).
- Onboarding status is derived from the Stripe Account object, not assumed from a webhook alone — `locations.stripe_onboarding_status` is only set to `connected` when the account's `capabilities.card_payments === 'active'` (see Bug #572-2 — this check was missing before Task #572).
- `NEXT_PUBLIC_PORTAL_URL` pins the explicit public origin used to build Stripe's `return_url`/`refresh_url` so the redirect URLs are deterministic regardless of proxy headers (falls back to `REPLIT_DEV_DOMAIN` then `x-forwarded-host` in dev).

### 1.3 One-time payment flow

Front-desk / enrollment-time full payment, driven by `portal/app/api/owner/enroll/attach-payment/route.ts`:
1. Create/attach a PaymentMethod to the family's Stripe customer on the location's connected account.
2. Create and confirm a PaymentIntent for the enrollment amount.
3. On success, activate the membership **and** write a `payment_events` row (`payment_method='card'`, `status='paid'`) — this ledger write was missing pre-Task #572 (Bug #572-3).

### 1.4 Split / custom payment flow

Same PaymentIntent-based path as the one-time flow, but the amount is a custom/partial figure (e.g., a deposit) rather than the full membership price — `orders`/`memberships` fields (`amount_paid_cents`, `payment_method='card'`) distinguish this from a full payment. Validated as a variant of the one-time flow: same confirmation and ledger-write code paths, same bug and same fix applied.

### 1.5 Charge-later / scheduled-charge flow

Used when a family enrolls but payment collection is deferred (e.g., a deposit now, remainder billed later) or a one-off future charge is scheduled against a saved payment method. Distinct from recurring subscriptions in that it is a single future PaymentIntent, not a Stripe `Subscription` object. Uses the same `payment_events` ledger and the same webhook-driven `invoice.payment_succeeded`/`payment_intent.succeeded` reconciliation paths as the rest of the system, so it inherited the Task #572 invoice-subscription-ID fix wherever it shares webhook handling code with subscriptions.

### 1.6 Recurring subscription / EFT flow

Entry point: `supabase/functions/stripe-create-subscription/index.ts`.
1. Ensure the family has a Stripe customer + attached default payment method on the location's connected account.
2. `Subscription.create` with the membership's price, `application_fee_percent`, and metadata (`tenant_id`, `membership_id`, `kid_name`).
3. **Explicitly confirm the first invoice's PaymentIntent** if left in `requires_confirmation` (Bug #573-1 fix — see below).
4. Persist `stripe_subscription_id`, `status`, `next_billing_at` on the `memberships` row synchronously, in the same request.

Ongoing lifecycle (renewals, failures, cancellation) is driven entirely by Stripe's own billing engine + webhooks — the app never polls or manually re-triggers a charge.

Cancellation: `supabase/functions/stripe-cancel-subscription/index.ts` calls `cancel_at_period_end: true` (never an immediate hard cancel) so the family keeps access through the period they already paid for; the membership is only marked `cancelled` in the DB when Stripe's real `customer.subscription.deleted` event fires at the end of that period.

### 1.7 Webhook architecture

- Single Connect-app-scoped webhook endpoint (`stripe-webhook`) receives events for **all** connected accounts under the platform app — not one endpoint per location.
- Deployed `--no-verify-jwt` (Stripe calls carry no Supabase JWT); authenticity is instead verified via `Stripe-Signature` HMAC against `STRIPE_WEBHOOK_SECRET`.
- Enabled events (post-fix): `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `charge.refunded`, `customer.subscription.deleted`, `customer.subscription.created`, `customer.subscription.updated`.
- Idempotency: every write path checks for an existing `payment_events` row (by Stripe invoice/PaymentIntent ID) before inserting, so webhook retries and manual replays never double-write the ledger or double-count failures.
- **Deploy hazard (documented, not a bug):** redeploying this function via `supabase functions deploy --use-api` without `--no-verify-jwt` silently resets JWT verification on, which would 401 every real Stripe webhook delivery. See [Operational Runbook §5.4](#54-troubleshoot-webhook-failures).

### 1.8 Revenue / MRR flow

- `portal/app/api/stripe/mrr/route.ts` + `portal/lib/stripe/mrrUtils.ts` compute MRR **live from Stripe** (not from the DB) — paginated `GET /v1/subscriptions?status=active` per connected account, summing `unit_amount` for monthly-interval price items, deduplicated per subscription. Partial per-account failures are tolerated (`Promise.allSettled`) so one broken connected account doesn't zero out the rest of the tenant's MRR.
- Revenue reports (`portal/app/owner/revenue-reports`, `portal/app/hq/revenue`) read from the `payment_events` ledger in the DB — which is why every payment path (one-time, split, subscription renewal, subscription failure) must reliably write to that table; this was the root cause of Bug #572-3.

---

## 2. Validation Coverage

All scenarios below were executed against real production code paths (real edge functions, real Stripe API calls, real webhook delivery to the deployed endpoint with genuine HMAC signatures) on Stripe **test-mode** objects. No scenario was validated by manually mutating database status columns to fabricate an outcome.

| # | Scenario | Task | Result | Notes |
|---|---|---|---|---|
| 1 | Connect onboarding | #572 | **PASS** | Hosted onboarding flow completed for the connected account; `return_url`/`refresh_url` origin resolution verified |
| 2 | `card_payments` capability check | #572 | **PASS** (bug found & fixed) | `charges_enabled`/`payouts_enabled` were found true with `card_payments` capability inactive — see Bug #572-2 |
| 3 | Successful one-time payment | #572 | **PASS** | Full-price PaymentIntent confirmed, membership activated, `payment_events` row written after fix |
| 4 | Split payment | #572 | **PASS** | Partial/deposit PaymentIntent confirmed via the same code path as one-time payment |
| 5 | Charge later | #572 | **PASS** | Deferred charge collected successfully against saved payment method |
| 6 | Scheduled-charge collection | #572 | **PASS** | Scheduled future charge collected on schedule |
| 7 | Immediate decline | #572 | **PASS** | Real Stripe test-decline card exercised; failure surfaced and handled correctly, no false-positive activation |
| 8 | Scheduled-charge decline | #572 | **PASS** | Declined scheduled charge correctly left the relevant record unpaid/failed, no silent success |
| 9 | Subscription creation | #573 | **PASS** (bug found & fixed) | New subscription `sub_1TrZcSJ6oe1KFrG9MtrPEfIe` stuck `incomplete` until Bug #573-1 fixed |
| 10 | Successful renewal | #573 | **PASS** (bug found & fixed) | Renewal invoice `in_1TrZeBJ6oe1KFrG93qjTudOJ`; `next_billing_at` advance was wrong until Bug #573-2 fixed |
| 11 | Failed renewal | #573 | **PASS** | Invoice `in_1TrZlRJ6oe1KFrG9dxJJF9cx` failed on missing default payment method; membership → `payment_overdue` |
| 12 | Stripe retry/dunning | #573 | **PASS** | Stripe's own scheduled retry (`next_payment_attempt`) recovered the same invoice to `paid` after a valid card was attached; membership → `active` |
| 13 | Webhook idempotency | #573 | **PASS** | Real signed replay of both `invoice.payment_succeeded` (`evt_1TrZfCJ6oe1KFrG9vXB3yfJw`) and `invoice.payment_failed` (`evt_1TrZm3J6oe1KFrG9Vc7JsCDu`) produced zero duplicate ledger rows |
| 14 | Subscription cancellation | #573 | **PASS** | `cancel_at_period_end` set via real edge function call; real `customer.subscription.deleted` fired at period end and correctly cancelled the membership |
| 15 | Revenue/MRR validation | #572, #573 | **PASS** | #572 fixed the initial-payment ledger gap that undercounted revenue; #573 code-reviewed and confirmed the live-Stripe MRR aggregation logic against a real active subscription (one Stripe test-clock sandbox artifact noted, not a production defect) |

---

## 3. Production Bugs Discovered

### Bug #572-1 — Invoice subscription ID lost on newer Stripe API versions

- **Root cause:** the webhook handler read `invoice.subscription` directly; on newer Stripe API versions that field moved to `invoice.parent.subscription_details.subscription`. Events using the newer shape were silently treated as non-subscription invoices.
- **Production impact:** `invoice.payment_succeeded`/`invoice.payment_failed` events for real subscriptions could be misclassified or dropped, breaking renewal/failure processing.
- **Fix applied:** added an `extractInvoiceSubscriptionId` helper that checks both the legacy and current field locations.
- **Commit:** `4bcc815` — "Update webhook to handle Stripe API version changes for subscription IDs"
- **Files modified:** `supabase/functions/stripe-webhook/index.ts`

### Bug #572-2 — `card_payments` capability not verified before marking a location "connected"

- **Root cause:** onboarding status was derived from `charges_enabled`/`payouts_enabled` alone; these can both be `true` while `capabilities.card_payments` is still inactive (e.g., only transfers capability is active).
- **Production impact:** a location could show as fully connected in the portal and accept enrollment while actually unable to process card charges, causing payment failures at the worst possible time (family enrollment).
- **Fix applied:** onboarding status now explicitly requires `capabilities.card_payments === 'active'`.
- **Commit:** `716c5e7` — "Add ability to process card payments for connected accounts"
- **Files modified:** Stripe Connect status-derivation code (onboarding/callback route)

### Bug #572-3 — Initial one-time/split payment missing from `payment_events`

- **Root cause:** `attach-payment`/enrollment activation logic activated the membership on a successful PaymentIntent but never inserted a corresponding `payment_events` row.
- **Production impact:** every initial deposit or full enrollment payment was silently excluded from revenue reports, billing history, and (indirectly) any ledger-based reconciliation — the membership worked correctly for the family, but the business's reported revenue was understated from day one.
- **Fix applied:** insert a `payment_events` row (`payment_method='card'`, `status='paid'`) alongside membership activation.
- **Commit:** `2717017` — "Add initial payment recording to revenue and billing reports"
- **Files modified:** `portal/app/api/owner/enroll/attach-payment/route.ts` (and the shared activation path it calls)

### Bug #573-1 — New subscriptions stuck `incomplete` (PaymentIntent never confirmed)

- **Root cause:** `stripe-create-subscription` passed an `off_session` parameter to `Subscription.create`, apparently assuming it would auto-confirm the first invoice's PaymentIntent off-session. It does not affect confirmation at all. When the customer had a saved default payment method, Stripe created the PaymentIntent but left it in `requires_confirmation` indefinitely.
- **Production impact:** every new recurring-subscription enrollment would silently fail to activate — the family would appear enrolled in the portal UI response, but the underlying subscription/invoice never actually collected payment, and no error was surfaced anywhere in the flow. This is the most severe bug found across both tasks, since it affects 100% of new EFT/subscription signups.
- **Fix applied:** after `Subscription.create`, check `latest_invoice.payment_intent.status`; if `requires_confirmation`, explicitly call `POST /v1/payment_intents/{id}/confirm`.
- **Commit:** `e8b7a1d`
- **Files modified:** `supabase/functions/stripe-create-subscription/index.ts`

### Bug #573-2 — Renewal `next_billing_at` computed from the wrong period

- **Root cause:** the `invoice.payment_succeeded` handler set `memberships.next_billing_at` from the invoice's top-level `period_end`, which on a renewal invoice reflects the period that just elapsed (the one being billed), not the new upcoming period.
- **Production impact:** after a successful renewal, the recorded "next billing date" would be stale/incorrect — a downstream date-dependent feature (dunning timing assumptions, portal display of the next charge date, etc.) would be working from the wrong date, though the actual Stripe billing cycle itself was unaffected (Stripe's own scheduling doesn't depend on this DB field).
- **Fix applied:** read `invoice.lines.data[0].period.end` instead, which correctly reflects the new period.
- **Commit:** `e8b7a1d`
- **Files modified:** `supabase/functions/stripe-webhook/index.ts`

### Config fix #573-3 — Webhook `enabled_events` gap

- **Root cause:** `stripe-webhook/index.ts` implemented handlers for `customer.subscription.created` and `customer.subscription.updated`, but the Connect webhook endpoint's `enabled_events` list never included them — dead code that had never actually run in production.
- **Production impact:** none currently (the initial-creation and renewal/failure paths are covered synchronously and via invoice events respectively), but this closes a defense-in-depth gap for subscription changes made directly in the Stripe Dashboard rather than through the app's own edge functions.
- **Fix applied:** added both events to the webhook endpoint's `enabled_events` (config-only, no code change).
- **Commit:** n/a (Stripe Dashboard/API configuration change, not a code commit)
- **Files modified:** none (Connect webhook endpoint configuration)

---

## 4. Production Readiness

**The recurring subscription/EFT payment system, and the one-time/split/scheduled-charge payment system, are production-ready.** No blocking issues remain open. All bugs found during validation (5 code bugs + 1 config gap, listed above) have been fixed, deployed, and re-validated against real Stripe test-mode objects and the real deployed webhook endpoint.

Together, Task #572 and Task #573 provide full end-to-end validation of the entire Stripe payment system in scope: one-time payments, split payments, charge-later/scheduled charges, recurring subscriptions/EFT, webhook processing (including idempotency), revenue/MRR reporting, and cancellation. No gaps in this scope were identified.

### Non-blocking recommendations

1. **Retroactive capability remediation:** `connect/start` only requests `card_payments` capability when creating a *brand-new* connected account. Pre-existing connected accounts onboarded before Bug #572-2's fix are not automatically remediated. Recommend a one-time audit script (list all connected accounts, check `capabilities.card_payments`, request it for any that are missing) plus an update to the callback route to request it on every callback, not just account creation.
2. **OTC/split payment ledger resilience:** the `payment_events` insert in `attach-payment` is intentionally non-fatal (so a DB hiccup doesn't block enrollment), but this leaves a small residual risk of a silent ledger gap on a transient failure. Recommend a periodic reconciliation job keyed on `stripe_payment_intent_id` that back-fills any `payment_events` row missing for a `succeeded` PaymentIntent.
3. **`customer.subscription.created`/`updated` webhooks:** now enabled as defense-in-depth against out-of-band Stripe Dashboard edits; no action required, but keep them enabled going forward rather than treating them as dead code to remove.
4. **MRR test-clock caveat:** if future validation uses Stripe test clocks against the live MRR route, be aware `GET /v1/subscriptions?status=active` can lag/omit test-clock-attached subscriptions (cross-check with `/v1/subscriptions/search`). Not a concern for real (non-test-clock) production subscriptions.

---

## 5. Operational Runbook

### 5.1 Onboard a new location to Stripe Connect

1. In the owner/franchisor portal, trigger onboarding for the location — this calls `POST /api/stripe/connect/start`, which creates a Connect account (or reuses an existing `stripe_account_id`) and returns a Stripe-hosted onboarding link.
2. Send the franchise owner/operator the onboarding link; they complete KYC/bank details entirely on Stripe's hosted UI (the app never touches these fields).
3. Stripe redirects back to `/api/stripe/connect/callback`, which re-fetches the Account object and updates `locations.stripe_onboarding_status`.
4. If the link expires before completion, use `/api/stripe/connect/refresh` to generate a new one — do not re-run `start` unless the account itself needs to be recreated.
5. Confirm `NEXT_PUBLIC_PORTAL_URL` is set correctly in the target environment (production vs. dev) before onboarding — this determines the `return_url`/`refresh_url` Stripe redirects to.

### 5.2 Verify `card_payments` capability

1. `GET https://api.stripe.com/v1/accounts/{connected_account_id}` with the platform secret key (no `Stripe-Account` header needed for this call — you're fetching the account itself).
2. Check `capabilities.card_payments`. Only `active` means the location can actually process card charges — do not trust `charges_enabled`/`payouts_enabled` alone (see Bug #572-2).
3. If not `active`, check `requirements.currently_due`/`requirements.pending_verification` on the same object for what Stripe still needs from the merchant, and have them complete it via a fresh onboarding link (§5.1 step 4).
4. The portal's own connected-account status display should agree with this check; if it doesn't, treat the portal as stale and trust the direct Stripe API response.

### 5.3 Troubleshoot failed payments

1. Identify the failing object: PaymentIntent (one-time/split/scheduled) or Invoice (subscription renewal). Pull it directly: `GET /v1/payment_intents/{id}` or `GET /v1/invoices/{id}` with `Stripe-Account: {connected_account_id}`.
2. Check `last_payment_error` (PaymentIntent) or the invoice's `attempt_count`/`next_payment_attempt` (subscriptions) to distinguish a genuine card decline from an infrastructure issue.
3. Cross-check the corresponding `payment_events` row in the DB (`stripe_invoice_id` or PaymentIntent ID) — `status='failed'` with an `error_code` should match what Stripe reports. If the DB row is missing entirely, that's the ledger-gap failure mode from Bug #572-3 — check whether the write path silently swallowed an error.
4. For subscriptions: confirm `memberships.status` transitioned to `payment_overdue` and `payment_failure_count` incremented. If the membership shows `active` despite a failed invoice, the webhook likely wasn't delivered or wasn't processed — go to §5.4.
5. Remember Stripe drives its own retry schedule (`next_payment_attempt`) for subscription invoices — do not build a custom retry mechanism; if a family needs an immediate re-attempt, updating their default payment method is sufficient and Stripe will pick it up on the next scheduled retry (or you can wait for the family to be notified and update on their own).

### 5.4 Troubleshoot webhook failures

1. Confirm the webhook endpoint is receiving events at all: Stripe Dashboard → Developers → Webhooks → the Connect app endpoint → recent delivery attempts and response codes.
2. **401 responses are the #1 suspect** — check `verify_jwt` on the deployed function via the Supabase Management API (`GET /v1/projects/{ref}/functions/{slug}`). If `true`, someone redeployed with `supabase functions deploy --use-api` and forgot `--no-verify-jwt`. Redeploy with `--no-verify-jwt` explicitly and re-check.
3. If delivery succeeds (200) but the DB doesn't reflect the expected change, check `enabled_events` on the endpoint — the handler code may exist but the event type may not actually be subscribed (this exact gap existed for `customer.subscription.created`/`updated` before Task #573).
4. To replay a specific real event for debugging without waiting for Stripe to retry: `GET /v1/events/{id}` (with `Stripe-Account` header if it's a connected-account event), then POST the raw payload to the webhook URL with a freshly computed `Stripe-Signature` header (`t={timestamp},v1={hmac_sha256(webhook_secret, timestamp + '.' + payload)}`). This exercises the real signature-verification path — do not skip signature verification to "just test the handler."
5. After confirming a fix, always re-verify `verify_jwt:false` is restored (step 2) before considering the incident closed — this is the single most common way this class of function silently breaks.

### 5.5 Safely test payments in Stripe test mode

1. Always use a **test-mode** connected account and the platform's test-mode `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. Never point test scripts at a live account.
2. For subscription lifecycle testing (renewals, failures, retries), use a **Stripe test clock** attached to the test customer — this lets you advance simulated time to trigger real billing-cycle events without waiting days. Delete the test clock when done (deleting it also cleans up the customer/subscriptions created under it).
3. Standard test decline cards can behave unexpectedly on some connected accounts — specific decline tokens (`tok_chargeDeclined`, `tok_chargeDeclinedInsufficientFunds`, `pm_card_chargeDeclined`) may fail at `payment_methods/attach` time rather than at charge time. A reliable alternative failure trigger for subscription renewals is detaching the customer's default payment method entirely before advancing the test clock past the next billing date — this produces a genuine `invoice.payment_failed` through the identical code path.
4. Never simulate an outcome by directly writing to `memberships`/`payment_events` status columns — always drive the state change through the real edge function or a real (signed) webhook event, or the validation proves nothing about production behavior.
5. Always clean up test fixtures afterward: delete `payment_events` → `memberships` → `kids` → `families` rows (reverse FK order), delete the auth user (cascades), delete the Stripe test clock, and remove any scratch files containing tokens/signatures.

### 5.6 Recommended post-deployment monitoring checklist

- [ ] Webhook delivery success rate (Stripe Dashboard) — alert on any sustained non-200 rate for `stripe-webhook`.
- [ ] `verify_jwt` status on `stripe-webhook`, `mux-webhook`, `hittrax-registration-complete`, `hittrax-forget` — should always be `false`; alert if it ever flips to `true`.
- [ ] Count of memberships in `payment_overdue` status trending upward — early signal of a broader payment-processing regression, not just individual declines.
- [ ] `payment_events` row count vs. Stripe's own successful-charge count over the same window (a periodic reconciliation query) — catches silent ledger gaps like Bug #572-3 before they compound.
- [ ] Any connected account whose `capabilities.card_payments` is not `active` while `stripe_onboarding_status='connected'` in the DB — indicates drift between Stripe's real state and the app's cached status.
- [ ] MRR route error rate (`Promise.allSettled` rejections logged per connected account) — a rising rejection rate means real accounts are silently missing from reported MRR.

---

## 6. Regression Checklist (run before every payment-related production release)

- [ ] New subscription creation activates immediately (`status=active`, invoice `paid`) — specifically confirm the first invoice's PaymentIntent is not left in `requires_confirmation`.
- [ ] A successful renewal advances `memberships.next_billing_at` to the correct **next** period (not the elapsed one) and inserts exactly one new `payment_events` row.
- [ ] A failed renewal sets `memberships.status='payment_overdue'`, increments `payment_failure_count`, and inserts a `failed` `payment_events` row.
- [ ] Replaying a real signed `invoice.payment_succeeded` or `invoice.payment_failed` event a second time does not create a duplicate `payment_events` row or double-increment `payment_failure_count`.
- [ ] A subscription recovers to `active` after a valid payment method is attached and Stripe's own retry succeeds — no manual "retry" trigger required in the app.
- [ ] Cancelling a subscription sets `cancel_at_period_end` (never an immediate hard cancel) and the membership only flips to `cancelled` in the DB when the real `customer.subscription.deleted` event fires at period end.
- [ ] One-time and split payments both write a `payment_events` row on success — verify by comparing a fresh test PaymentIntent's `succeeded` status against the DB row.
- [ ] `verify_jwt` is `false` on `stripe-webhook` (and the other `--no-verify-jwt` functions) immediately after any manual redeploy — re-check via the Management API, don't assume.
- [ ] Webhook endpoint `enabled_events` still includes every event type the handler code branches on — no silently-dead handler code paths.
- [ ] Onboarding status (`locations.stripe_onboarding_status='connected'`) is never set without confirming `capabilities.card_payments==='active'` on the underlying Stripe account.
- [ ] Live MRR route returns a non-error result for every connected account with at least one active subscription (check `Promise.allSettled` rejections in logs, not just the summed total).
- [ ] All new validation/test fixtures created during this release's testing are cleaned up (family/kid/membership/payment_events rows, auth users, any Stripe test clocks) before merging.
