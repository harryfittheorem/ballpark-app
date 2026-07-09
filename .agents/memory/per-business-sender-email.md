---
name: Per-business branded sender email
description: Pattern for building Resend "From"/"Reply-To" headers per-tenant across portal routes and edge functions
---

Branded sender emails (business name in From display, tenant/location email as Reply-To) are built via a shared `buildEmailSender({businessName, replyToEmail})` + `sendResendEmail`/`sendBrandedEmail` helper pair, duplicated in `portal/lib/email.ts` (portal routes) and `supabase/functions/_shared/email.ts` (edge functions) since edge functions can't import from `portal/`.

**Why:** Before this, every send site built its own raw `fetch('https://api.resend.com/emails')` call with a flat `RESEND_FROM_EMAIL` env var, so all outbound mail looked identical regardless of tenant, and errors were silently swallowed in several call sites.

**How to apply:** Any new outbound email call site (portal route or edge function) should resolve `businessName` (from `tenants.name`) and `replyToEmail` (from `locations.email`) for the relevant tenant/location, then call the shared helper — never re-add a raw Resend fetch or reference a flat `RESEND_FROM_EMAIL`. `sendResendEmail` returns `{ok, error?}` only — no `messageId`. When a call site needs sender resolution more than once, a local `resolveSender(supabase, tenantId, locationId)` async helper (Promise.all over two maybeSingle lookups) is the established pattern — see `collect-scheduled-charges/index.ts` and `stripe-webhook/index.ts` for reference implementations.
