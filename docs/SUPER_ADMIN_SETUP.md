# Super Admin Setup

Super admins have cross-tenant access to the `/hq` console in the Ballpark portal. They can manage all franchises, locations, team members, and view network-wide revenue.

## Prerequisites

- `EXPO_PUBLIC_SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role key (never expose client-side)

Both must be set in your environment before running the script.

## Provisioning a Super Admin

```bash
node scripts/provision-superadmin.mjs <email> <password> <name>
```

**Example:**

```bash
node scripts/provision-superadmin.mjs "hq@ballpark.app" "S3curePass!" "Alex Smith"
```

**The script:**

1. Checks if the email already exists in Supabase Auth (idempotent).
2. Creates the auth user with `email_confirm: true` and `app_role: 'super_admin'` in user metadata.
3. Upserts a row in the `super_admins` table.
4. **Cleanup on failure:** if Step 3 fails (e.g. `super_admins` table doesn't exist yet), the script deletes the orphaned auth user it just created and exits with code 1. If the user already existed before the run, they are **not** deleted.

## Verifying the Role is Working

After provisioning, log into the portal with the super admin credentials. The JWT should contain:

```json
{ "app_role": "super_admin" }
```

To inspect a JWT directly:

```bash
node scripts/decode-jwt.mjs  # or paste at jwt.io
```

If the `app_role` claim is missing after login, the `custom_access_token_hook` may not be wired to the project. Verify in **Supabase Dashboard → Authentication → Hooks** that `custom_access_token_hook` is enabled.

**Stale JWT:** If the user was previously logged in with a different role, they must sign out and back in to get a fresh JWT.

## The `/hq` Routes

| Route | Purpose |
|-------|---------|
| `/hq` | Dashboard — network KPIs, quick links |
| `/hq/locations` | View, create, edit, and deactivate franchise locations |
| `/hq/team` | View, invite, edit roles, and deactivate team members |
| `/hq/revenue` | 30-day network revenue, per-location MRR, CSV export |
| `/hq/settings` | Global network branding (logo/favicon URL) and per-tenant royalty rates |

## Deactivating a Super Admin

Super admins can be soft-banned from the `/hq/team` page (click the pencil icon on any row) or via the Supabase Auth admin API:

```bash
# Ban (block login for ~100 years)
curl -X PUT "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"ban_duration": "876000h"}'

# Unban
curl -X PUT "${SUPABASE_URL}/auth/v1/admin/users/${USER_ID}" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"ban_duration": "none"}'
```

Deactivating a super admin does **not** remove their `super_admins` row. The JWT hook will still inject `app_role: super_admin` if they somehow bypass the ban, so for permanent removal also delete the `super_admins` row:

```sql
DELETE FROM public.super_admins WHERE email = 'user@example.com';
```

## Gotchas

- **Migration must be applied first.** The `super_admins` table is created by `supabase/migrations/20260514000003_super_admin.sql`. If the table doesn't exist, the provisioning script will fail cleanly and print an error. Run `npx supabase db push` to apply all pending migrations.
- **`tenant_config` branding columns.** Global network branding (logo/favicon URL) is stored as nullable columns on the primary HQ tenant's `tenant_config` row (migration `20260602000002_hq_settings.sql` adds `royalty_rate_override`, `network_logo_url`, and `network_favicon_url` columns). Apply migrations before using the `/hq/settings` page.
- **Hook registration.** The `custom_access_token_hook` must be registered in Supabase Auth settings (Dashboard → Auth → Hooks). It is not auto-registered by migrations.
- **Portal env vars.** The portal uses `NEXT_PUBLIC_SUPABASE_URL` (not `EXPO_PUBLIC_SUPABASE_URL`) for Supabase calls. Both are required: the script uses the Expo-prefixed var; the portal uses the Next.js-prefixed var.
