---
name: JWT claims vs app_metadata in edge functions
description: Custom Access Token Hook injects tenant_id/app_role into the JWT payload only — never into raw_app_meta_data. Edge functions must decode the JWT, not use auth.getUser() app_metadata.
---

## Rule
The Custom Access Token Hook (`public.custom_access_token_hook`) writes claims to the JWT payload via `jsonb_set(event, '{claims}', v_claims)`. It does NOT update `raw_app_meta_data` in `auth.users`.

When an edge function calls `callerClient.auth.getUser()`, Supabase returns the user's stored `app_metadata` (= `raw_app_meta_data` from DB). This will NEVER contain `tenant_id` or `app_role` for hook-injected claims.

**Wrong (always returns undefined):**
```ts
const callerTenantId = user.app_metadata?.tenant_id ?? '';
```

**Correct (reads from JWT payload):**
```ts
const callerTenantId: string = (() => {
  try {
    const parts = callerToken.split('.');
    if (parts.length < 2) return '';
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64)) as Record<string, unknown>;
    return (payload.tenant_id as string | undefined)
      ?? (user.app_metadata?.tenant_id as string | undefined)
      ?? '';
  } catch {
    return (user.app_metadata?.tenant_id as string | undefined) ?? '';
  }
})();
```

`auth.getUser()` is still called first to verify the token signature and confirm the user exists — only the tenant_id/app_role reading is moved to JWT decode.

**Why:** The hook only runs at token issuance time and puts claims in the JWT payload. The portal's `readTenantId(session)` in `portal/lib/auth.ts` uses this same JWT-decode approach correctly.

**Where this applies:** All Supabase Edge Functions that authenticate callers and need to read `tenant_id` or `app_role` from the token: `stripe-create-subscription`, `stripe-cancel-subscription`, `pause-membership`, `resume-membership`, etc.
