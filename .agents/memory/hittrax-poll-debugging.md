---
name: HitTrax poll pipeline debugging
description: Durable lessons from getting hittrax-poll edge function fully operational — cron auth, date format, FullPlays field names, partial index bug
---

## Cron auth key format
Replit's `SUPABASE_SERVICE_ROLE_KEY` is `sb_secret_...` format (not a JWT). The pg_cron job must use this directly as the Bearer token in the HTTP request to the edge function. Old `eyJ...` JWT format does not apply.

**Why:** Replit injects the service role key in their own format, not as a raw JWT.

## Edge function deploy
Always use `--use-api` flag:
```
npx supabase functions deploy <name> --use-api --project-ref exjcwvvglthnxerzpukw
```
**Why:** DNS for the standard deploy path is blocked in the Replit sandbox.

## HitTrax date format
`formatHitTraxDate` must omit milliseconds. ASP.NET model binder rejects the ISO 8601 colon-before-ms format with a generic 400. Removing ms allows HitTrax's own validation to run.

**Why:** HitTrax backend is ASP.NET and doesn't accept the `:ms` suffix.

## ContentType is partner-specific
`HITTRAX_CONTENT_TYPE=FullPlays` — this value came from the partner onboarding email. It is NOT in the public API spec. Other partners may use different values.

## FullPlays field name mapping
The `FullPlays` content type uses completely different JSON field names than the v1.3 spec:

| Our field | Spec name (wrong) | Actual FullPlays key |
|---|---|---|
| `occurred_at` | `TimeStamp` | `TS` |
| `launch_angle_deg` | `LaunchAngle` | `Elv` |
| `session_id` (capture) | `SessionID` | `SnId` (session number; `SId` is user ID) |
| `result` | `Result` | `Res` |
| `pitch_speed_mph` | `PitchSpeed` | `PV` |
| `exit_velocity_mph` | `ExitVelocity` | `Velo` (already correct) |
| `distance_ft` | `Distance` | `Dist` (already correct) |
| `spray_angle_deg` | `SprayAngle` | `HorzAngle` (already correct) |

**Why:** HitTrax uses abbreviated field names in FullPlays vs longer names in other content types.

## Partial unique index + ON CONFLICT bug
`ON CONFLICT (capture_source, capture_session_id)` cannot target a partial unique index
(`WHERE capture_session_id IS NOT NULL`) — PostgreSQL requires the WHERE predicate to be
included in the conflict specification. Supabase JS `upsert()` does not support partial
index conflict targets.

**Fix:** Migration `20260626000000_fix_sessions_capture_unique.sql` replaces the partial
index with a full unique index. NULL values are still allowed (NULL != NULL in SQL, so
multiple NULL `capture_session_id` rows coexist fine).

**Why:** This is a standard PostgreSQL constraint — partial indexes need their WHERE clause
in the ON CONFLICT clause. Easy to miss since the error only shows at runtime.

## Historic backfill
To pull historical HitTrax data after account link:
```sql
UPDATE kid_capture_links
SET associated_at = NOW() - INTERVAL '90 days',
    last_polled_through = NULL,
    retry_count = 0,
    next_poll_at = NULL
WHERE capture_source = 'hittrax';
```
The next cron tick will fetch the full window from that date to now in one batch.
