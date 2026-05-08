# HitTrax integration runbook

Task #118. Foundation for #119 (Sessions list), #120 (Stats), #121 (Sessions
detail), #122 (PR notifications hardening).

## What we ship

| Path | Role |
|------|------|
| `supabase/migrations/20260508060000_v07_hittrax_capture_pipeline.sql` | `sessions`, `swings`, `personal_bests`, `kid_capture_links` + `detect_swing_pr` trigger |
| `supabase/functions/hittrax-associate` | parent JWT → POST AssociateThirdPartyAccount |
| `supabase/functions/hittrax-registration-complete` | `--no-verify-jwt` HitTrax inbound (Accepted/Declined) |
| `supabase/functions/hittrax-poll` | service-role; pg_cron; pulls GetAvailableThirdPartyData |
| `supabase/functions/hittrax-disconnect` | parent JWT → POST RemoveThirdPartyAssociation |
| `supabase/functions/hittrax-forget` | `--no-verify-jwt` HitTrax inbound (GDPR purge from HitTrax → us) |
| `supabase/functions/_shared/hittrax.ts` | URL builder, response parser, swing-payload mapper, constant-time auth |
| `src/api/hittrax.ts` + `src/hooks/useHitTraxLink.tsx` | client SDK |
| `src/screens/Me/ConnectHitTraxScreen.tsx` | parent connect/disconnect UI |
| `scripts/replay-hittrax-fixture.mjs` | local fixture replay (no HitTrax keys needed) |

### `hittrax-forget` direction (inbound, by design)

HitTrax v1.0 spec defines `ForgetHitTraxUser` as a **HitTrax-initiated**
callback we host: when a HitTrax user requests data deletion through HitTrax,
HitTrax POSTs us, and we purge that user's locally-cached HitTrax data
(swings + HitTrax-sourced personal_bests + the link row). Our endpoint
returns `text/plain` per spec and authenticates with the same constant-time
PartnerID + APIKey check as `hittrax-registration-complete`.

The **parent-initiated outbound disconnect** is the separate
`hittrax-disconnect` Edge Function: it calls HitTrax's
`RemoveThirdPartyAssociation` first and only then flips our local link to
`removed`, so HitTrax stops sending us further data even before our local
purge runs. The two functions cover the two propagation directions:

| Trigger                         | Function                          | Calls                          | Purges local? |
|---------------------------------|-----------------------------------|--------------------------------|---------------|
| Parent taps Disconnect          | `hittrax-disconnect`              | `RemoveThirdPartyAssociation`  | flips link only — historical swings retained |
| HitTrax-side delete-my-data     | `hittrax-forget` (this endpoint)  | (inbound — no outbound call)   | swings + PBs + link row purged |
| Parent deletes Ballpark account | `account-delete` (parent JWT)     | `RemoveThirdPartyAssociation` + `ForgetHitTraxUser` per active link | family-wide cascade via auth.admin.deleteUser + FKs |

## Polling cadence + backoff

`hittrax-poll` runs every 2 minutes via pg_cron. For each active link the
worker selects rows where `next_poll_at IS NULL OR next_poll_at <= now()`,
so a healthy link is poll-eligible on every tick and a backed-off link
sits out until its delay elapses.

On any transient failure (HitTrax timeout, unreachable, 5xx, "Error …" 200
body, parse drift, partial parse with ANY dropped row, partial swing-upsert
failure) the worker calls `recordFailure(link, retry_count, error)` which:

- increments `retry_count` (capped exponent 30)
- writes `next_poll_at = now() + min(30 * 2^(retry_count-1), 30m)`
- leaves `last_polled_through` untouched so the next eligible poll
  re-fetches the same window (the swings UNIQUE absorbs already-stored
  rows).

Backoff schedule: 30s → 1m → 2m → 4m → 8m → 16m → 30m (capped). On the
next successful poll both columns reset (`retry_count = 0`,
`next_poll_at = null`).

## PR push fan-out (one push per swing)

Personal-best detection inside `hittrax-poll` collapses every metric a
swing topped (`exit_velocity_mph`, `distance_ft`, `pitch_speed_mph`) into
a SINGLE push notification per swing — matching the canonical
`detect_swing_pr` trigger which writes one `points_ledger reason='pr_hit'`
row per qualifying swing. The push title uses a priority order
(exit velo → distance → pitch speed) for the headline metric, and the
push `data.metrics` array carries every metric that PR'd so the client
can render however it likes. Per-metric notifications were a
duplicate-notification bug.

## Secrets (Supabase Edge Function env)

Set via `npx supabase secrets set KEY=...`. **Never** prefix `EXPO_PUBLIC_`.

| Key | Notes |
|-----|-------|
| `HITTRAX_BASE_URL` | per-environment, no trailing slash |
| `HITTRAX_PARTNER_ID` | issued manually by HitTrax per page 2 of spec |
| `HITTRAX_API_KEY` | issued with PartnerID; treat like a database password |
| `HITTRAX_CONTENT_TYPE` | optional; defaults to `Swings`. Override per the contracted ContentType list |

The five Edge Functions all return `503 hittrax_not_configured` until the
three required keys are present, so deploys are safe before keys land.

## Deploy

`scripts/post-merge.sh` runs after every task merge. The two inbound endpoints
(`hittrax-registration-complete`, `hittrax-forget`) deploy with
`--no-verify-jwt` because HitTrax authenticates with PartnerID + APIKey URL
params — there is no JWT.

```
npx supabase functions deploy hittrax-associate
npx supabase functions deploy hittrax-poll
npx supabase functions deploy hittrax-disconnect
npx supabase functions deploy hittrax-registration-complete --no-verify-jwt
npx supabase functions deploy hittrax-forget --no-verify-jwt
```

Give HitTrax these two callback URLs (replace `<project-ref>`):

```
https://<project-ref>.functions.supabase.co/hittrax-registration-complete
https://<project-ref>.functions.supabase.co/hittrax-forget
```

## Cron

`hittrax-poll` is service-role only and intended to run every 2 minutes.
Once the keys are provisioned, install the cron job (one-time, in Supabase
SQL editor as service role):

```sql
SELECT cron.schedule(
  'hittrax-poll-2min',
  '*/2 * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<project-ref>.functions.supabase.co/hittrax-poll',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type',  'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);
```

The function caps each run at 50 active links and sorts by oldest
`last_polled_at` first, so a stalled link can never starve fresh ones.

## Lifecycle

```
parent enters HitTrax UserID
        │
        ▼
hittrax-associate ───▶ HitTrax AssociateThirdPartyAccount
        │                      │
        │                      ▼
        │              email to parent's HitTrax account
        │                      │
        ▼                      ▼ (Accept|Decline)
kid_capture_links     hittrax-registration-complete (← HitTrax)
status='pending'              │
                              ▼
                      status='active' (or 'declined')
                      password persisted, last_polled_through=now
                              │
                              ▼  every 2 min, service role
                      hittrax-poll → GetAvailableThirdPartyData
                              │
                              ▼
                      sessions UPSERT + swings UPSERT
                              │
                              ▼  AFTER INSERT trigger
                      detect_swing_pr → personal_bests + points_ledger +15
                              │
                              ▼  best-effort, Promise.allSettled
                      send-push-notification
```

Disconnect: parent → `hittrax-disconnect` → HitTrax `RemoveThirdPartyAssociation` → flip link to `removed`.

GDPR: HitTrax → `hittrax-forget` → delete swings + sessions + personal_bests for the kid → flip link to `removed`.

## Idempotency contract

| Layer | Key |
|-------|-----|
| Sessions | `UNIQUE (capture_source, capture_session_id)` (partial; manual sessions excluded) |
| Swings | `UNIQUE (capture_source, capture_event_id)` — replays UPSERT, never duplicate |
| PR ledger | partial `UNIQUE (reference_id) WHERE reason='pr_hit' AND reference_type='swing'` |
| Polling cursor | `last_polled_through` advanced **only** after successful UPSERT batch |
| Inbound `registration-complete` | re-delivery against existing `active` row is a graceful no-op |
| Inbound `forget` | re-delivery against already-removed link returns `"true"` |

## Testing without HitTrax keys

```
node scripts/replay-hittrax-fixture.mjs <kid_uuid>
```

Run twice; the second run inserts zero rows (UPSERT idempotent), and
`personal_bests` / `kids.points_balance` remain unchanged. Edit the fixture
to bump `Velo` past the prior best to see a fresh PR + ledger row.

## Open items (deferred / contract-pending)

- **Canonical swing field names.** `_shared/hittrax.ts` `FIELD_MAP` accepts the
  common HitTrax dashboard variants (`Velo`, `LaunchAngle`, `Distance`, …).
  Tighten to the contracted ContentType schema once the keys + sample
  payloads land. Update once and every caller benefits.
- **Backfill on link activation.** `last_polled_through` is seeded to the
  activation timestamp — historical swings before that are NOT pulled in v1.
  Backfill ships as a follow-up if/when product asks.
- **Realtime UI flip.** `useHitTraxLink` subscribes to a postgres_changes
  Realtime channel scoped to the family's `kid_capture_links` rows and
  invalidates the React Query cache on UPDATE — so the Home banner and
  Me → HitTrax screen flip from "pending" → "active" the instant
  `hittrax-registration-complete` writes the row, with no manual refresh.
  A 5-second `refetchInterval` is kept as a defense-in-depth fallback in
  case the websocket is dropped (airplane mode, background → foreground,
  etc.). To disable the fallback once Realtime delivery is fully trusted
  in production, set the `refetchInterval` in `src/hooks/useHitTraxLink.tsx`
  to `false`.
