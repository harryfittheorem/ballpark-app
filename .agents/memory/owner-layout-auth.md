---
name: Owner layout auth pattern
description: How to correctly check auth in the owner (and other portal) layouts — service client cannot read sessions.
---

The owner layout (and any portal layout) must use the **cookie-based** `createClient()` from `@/lib/supabase/server` for auth checks, NOT `createServiceClient()`.

`createServiceClient()` is a plain `@supabase/supabase-js` client with `persistSession: false` and no SSR cookie adapter. Calling `auth.getUser()` or `auth.getSession()` on it always returns null — it cannot see the user's session cookies.

**Correct pattern:**
```ts
const userClient = await createClient();        // cookie-based (reads session)
const serviceClient = createServiceClient();    // service-role (for data queries)

const { data: { session } } = await userClient.auth.getSession();
if (!session) redirect('/login?reason=unauthenticated');
const user = session.user;

// Use serviceClient only for data queries that need to bypass RLS:
const { data } = await serviceClient.from('kids').select('*').eq('tenant_id', tenantId);
```

**Why:** This was broken when all owner pages were migrated to use service-role client for data queries — the auth check was accidentally also moved to the service client, making every `/owner/*` page immediately redirect to login regardless of session state.

**How to apply:** Any time you add a layout or page that needs to verify auth AND also make service-role data queries, always keep them in separate clients. The auth check always goes through `createClient()`.
