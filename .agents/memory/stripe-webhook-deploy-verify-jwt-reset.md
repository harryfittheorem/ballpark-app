---
name: Stripe webhook deploy resets verify_jwt
description: Redeploying a --no-verify-jwt edge function via --use-api alone silently re-enables JWT verification, breaking real webhook delivery.
---

Redeploying an edge function with `npx supabase functions deploy <fn> --use-api` (no other
flags) resets `verify_jwt` to its default (`true`) even if it was previously deployed with
`--no-verify-jwt`. Stripe/Mux/etc. webhook calls carry no Supabase JWT, so this silently
turns every future webhook delivery into a 401 — the function still "works" for manually
authenticated test calls, masking the break until real traffic arrives.

**Why:** caught mid-session when a webhook replay test started failing after an unrelated
redeploy; `GET` on the Management API confirmed `verify_jwt` had flipped back to `true`.

**How to apply:** any manual redeploy of `stripe-webhook`, `mux-webhook`,
`hittrax-registration-complete`, or `hittrax-forget` (Ballpark's `--no-verify-jwt` functions)
must re-pass `--no-verify-jwt` on every deploy, and should be followed by a Management API
check (`GET /v1/projects/{ref}/functions/{slug}`) confirming `verify_jwt:false` before trusting
the deploy. `scripts/post-merge.sh` already does this correctly for CI-driven redeploys —
this hazard is specific to ad hoc manual redeploys during debugging.
