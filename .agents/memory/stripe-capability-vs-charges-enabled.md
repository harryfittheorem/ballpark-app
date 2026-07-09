---
name: Stripe Connect capability vs charges_enabled
description: charges_enabled/payouts_enabled being true does not mean a capability like card_payments is active — check capabilities explicitly.
---

A Stripe Connect account can have `charges_enabled: true` and `payouts_enabled: true`
while `capabilities.card_payments` is missing or `'inactive'` — e.g. an account that
only has the `transfers` capability active. In that state, no card charge (success
or decline) can actually be processed, even though the coarse enabled flags look green.

**Why:** Found this while investigating why a connected-account dashboard showed
"CONNECTED — card payments enabled" for an account that could not actually take
a card payment. The onboarding-status derivation logic checked only
`charges_enabled && payouts_enabled`, never `capabilities.card_payments`.

**How to apply:** Any code that derives a human-facing "is this Stripe account
ready to take payments" status must check `capabilities.card_payments === 'active'`
explicitly, not just the coarse enabled booleans. When `disabled_reason` is absent
but the capability still isn't active, treat it as `pending` (mid-onboarding),
not `connected`. OAuth-connected (non-Express-managed) accounts also reject any
API write to identity/person fields or documents (`oauth_not_supported`) — real
KYC document upload for those accounts can only be completed through Stripe's
hosted Account Link onboarding flow, never via direct API calls.
