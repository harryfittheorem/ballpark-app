---
name: HitTrax poll debugging findings
description: Lessons from getting hittrax-poll cron working — auth, date format, ContentType
---

## pg_cron auth (service role key)

The `SUPABASE_SERVICE_ROLE_KEY` in the Replit environment is in `sb_secret_...` format (Supabase's new key format), NOT a `eyJ...` JWT. The edge function's `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` returns this same `sb_secret_...` value. The old-style JWT visible in the Supabase dashboard under "legacy keys" does NOT match.

To build the cron job correctly, write the SQL to a temp file with shell variable expansion, then run with `--file`:
```bash
cat > /tmp/setup_cron.sql << SQLEOF
SELECT cron.schedule('hittrax-poll-every-2min', '*/2 * * * *',
  $cron_body$
    SELECT net.http_post(
      url := 'https://exjcwvvglthnxerzpukw.supabase.co/functions/v1/hittrax-poll',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ${SUPABASE_SERVICE_ROLE_KEY}'),
      body := '{}'::jsonb);
  $cron_body$);
SQLEOF
npx supabase db query --linked --file /tmp/setup_cron.sql
```

**Why:** The cron SQL is stored in the DB. Shell writes it to a file with `$SUPABASE_SERVICE_ROLE_KEY` expanded, so the actual secret value lands in the SQL before execution.

## Edge function deploys (Replit sandbox)

Always use `--use-api` flag — the local bundler tries to fetch Deno stdlib from deno.land which is DNS-blocked in Replit:
```bash
npx supabase functions deploy <name> --use-api --project-ref exjcwvvglthnxerzpukw
```

## HitTrax date format

Spec says `YYYY-MM-DDTHH:MI:SS:SSS` (colon before ms). ASP.NET's model binder rejects this with a generic `{"Message":"The request is invalid."}` 400 BEFORE HitTrax's own validation runs. Fix: omit milliseconds entirely — use `YYYY-MM-DDTHH:MM:SS`. HitTrax's own validation errors ("Invalid Start Date") only appear after ASP.NET parsing succeeds.

## HitTrax ContentType

`ContentType` is a required parameter for `GetAvailableThirdPartyData`. The value is **partner-specific** — assigned by HitTrax during partner onboarding/contracting (spec v1.3 p.15). Neither `"Swings"` nor `"HitTrax"` are valid for Infinite Hitting's account. The correct value must come from HitTrax or from Infinite Hitting's partner agreement.

Set via: `npx supabase secrets set HITTRAX_CONTENT_TYPE=<value> --project-ref exjcwvvglthnxerzpukw`

No redeploy needed — secrets are injected per-invocation.

## Diagnosing poll errors

`last_poll_error` in `kid_capture_links` now stores the actual HitTrax response body (up to 200 chars), not just the HTTP status code. Check with:
```sql
SELECT last_polled_at, last_poll_error, retry_count, next_poll_at
FROM kid_capture_links WHERE capture_source = 'hittrax';
```

Backoff resets: `UPDATE kid_capture_links SET retry_count=0, next_poll_at=NULL WHERE capture_source='hittrax';`
