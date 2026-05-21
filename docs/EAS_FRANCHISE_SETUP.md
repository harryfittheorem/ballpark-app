# EAS Build Profiles — Franchise Setup Guide

`eas.json` defines one named build profile per franchise. This document
explains how to add a new profile when onboarding a new franchise location.

## Current profiles

| Profile name               | Tenant slug          | Purpose                              |
|---------------------------|---------------------|--------------------------------------|
| `development`              | (env default)       | Internal dev build (Expo Dev Client) |
| `preview`                  | (env default)       | Internal distribution / QA           |
| `production`               | (env default)       | Generic production (no slug pin)     |
| `production-infinitehitting` | `infinitehitting` | Infinite Hitting production build    |

## Adding a new franchise profile

### 1. Provision the tenant in Supabase

```sql
-- Run in the Supabase SQL editor (or via migration) for the new tenant.
INSERT INTO public.tenants (id, name, slug)
VALUES (gen_random_uuid(), 'My New Gym', 'mynewgym');
```

Record the generated UUID as `<NEW_TENANT_ID>`.

### 2. Add the build profile to `eas.json`

Open `eas.json` and add a new entry under `"build"`:

```json
"production-mynewgym": {
  "autoIncrement": true,
  "env": {
    "EXPO_PUBLIC_TENANT_SLUG": "mynewgym"
  }
}
```

Naming convention: `production-<slug>` in lowercase, matching exactly the
`slug` column in the `tenants` table.

### 3. Set tenant-specific Supabase env vars (optional)

If the new franchise uses its own Supabase project, create a separate
`.env.mynewgym` and pass it via the EAS environment or EAS Secrets:

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL_MYNEWGYM \
  --value "https://xxxx.supabase.co"
```

For a single-project multi-tenant setup (current architecture), no extra
Supabase vars are needed — `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` are shared.

### 4. Build and submit

```bash
# Build for the new franchise
eas build --profile production-mynewgym --platform ios
eas build --profile production-mynewgym --platform android

# Submit to stores (uses the default "submit" config in eas.json)
eas submit --platform ios  --latest
eas submit --platform android --latest
```

### 5. Seed initial data for the new tenant

```bash
EXPO_PUBLIC_TENANT_SLUG=mynewgym node scripts/seed-portal-demo-data.mjs
```

Or provision a real owner account via the Supabase dashboard and point the
new app binary at the correct tenant slug.

## Checklist

- [ ] `tenants` row inserted with correct `slug`
- [ ] `tenant_config` row inserted (defaults `allow_cross_location_booking = false`)
- [ ] At least one row in `locations` with `tenant_id = <NEW_TENANT_ID>`
- [ ] Build profile added to `eas.json` with matching `EXPO_PUBLIC_TENANT_SLUG`
- [ ] EAS build + submit completed for both platforms
- [ ] App Store / Play Store listing created for the new franchise (separate app or same with different bundle ID, per your franchise model)
