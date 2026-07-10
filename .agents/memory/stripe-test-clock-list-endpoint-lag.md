---
name: Stripe test-clock subscriptions missing from list endpoint filters
description: GET /v1/subscriptions?status=active can omit subscriptions attached to a test clock even though the object is genuinely active; not a production bug.
---

`GET /v1/subscriptions?status=active` (and other top-level list filters) can return an empty
result for a subscription that has a `test_clock` attached, even though `GET
/v1/subscriptions/{id}` and `GET /v1/subscriptions/search?query=status:'active'` both
correctly show it `active` at the same moment. The list endpoint appears to use a secondary
index that lags/excludes test-clock objects; direct-ID lookups and `/search` read the primary
store and are always correct.

**Why:** discovered while validating a live-Stripe MRR aggregation route — the route's exact
query returned 0 active subscriptions against a connected account that had one confirmed-active
test-clock subscription, which looked like a code bug until cross-checked against `/search`
and direct GET.

**How to apply:** real (non-test-clock) production subscriptions are not subject to this lag.
When validating MRR/reporting code that lists subscriptions by status against a test-clock
fixture, don't trust a mismatch as a code bug until you've cross-checked with
`/v1/subscriptions/search?query=status:'...'` or a direct-ID GET — if those disagree with the
list endpoint only for test-clock objects, it's a sandbox artifact.
