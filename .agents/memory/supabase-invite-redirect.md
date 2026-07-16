---
name: Supabase invite redirect_to
description: How to make generate_link redirect_to work correctly for invite emails
---

## The rule

Never use `action_link` from `generate_link` directly in invite emails. Always build
a clean `/auth/v1/verify` URL using `hashed_token` from the same response.

```typescript
const params = new URLSearchParams({
  token: linkBody.hashed_token,
  type: 'invite',
  redirect_to: `${portalOrigin}/auth/accept-invite`,
});
const inviteLink = `${new URL(supabaseUrl).origin}/auth/v1/verify?${params.toString()}`;
```

**Why:**
- `action_link` uses the configured Site URL as origin — often `localhost:3000`
- Implicit-flow `action_link` embeds session in URL hash → email clients strip it
- `/auth/v1/verify` keeps the token as a query param → survives email delivery
- After verification Supabase redirects to `redirect_to` with session in hash → browser handles it fine

## uri_allow_list must include the portal domain

Supabase silently ignores `redirect_to` if the domain is not in `uri_allow_list`.
Falls back to Site URL (localhost). Update via Management API:

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/{ref}/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"uri_allow_list": "https://your-dev-domain/**,https://your-prod-domain/**"}'
```

The Management API field is `uri_allow_list` (NOT `additional_redirect_urls`).

## accept-invite page

Use `onAuthStateChange` (not `getSession` + timeout) — it fires as soon as the
Supabase SDK exchanges the hash-fragment tokens that Supabase appends after verify.
