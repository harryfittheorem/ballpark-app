// =============================================================================
// supabase/functions/hittrax-poll/index.ts
// =============================================================================
// Task #118 Step 5 — Polling worker for active HitTrax links.
//
// Trigger: Supabase scheduled invocation (every 2 minutes via pg_cron — see
// runbook). May also be invoked on-demand via POST with the service-role
// bearer for ops / fixture replay.
//
// For each active kid_capture_links row (oldest last_polled_at first),
// calls HitTrax GetAvailableThirdPartyData with:
//   StartDate = last_polled_through (or associated_at on first poll)
//   EndDate   = now() - SLACK_SECONDS  (small safety margin so HitTrax
//               isn't still buffering swings at the boundary)
//
// On success:
//   * Parses the returned JSON via parseSwingsPayload.
//   * For each swing: UPSERT into sessions (one per session_id) + UPSERT
//     into swings (idempotent on (capture_source, capture_event_id)).
//   * Advances last_polled_through to EndDate, clears last_poll_error.
//   * Best-effort fans out a push notification per detected PR via
//     send-push-notification (Promise.allSettled — never blocks the cursor).
//
// On HitTrax error / timeout:
//   * Records last_poll_error on the link, leaves last_polled_through
//     untouched so the next run retries the same window.
//
// Concurrency: Edge Functions are stateless and may overlap if a poll runs
// longer than 2 min. Per-link work is naturally serialised because we
// advance last_polled_through atomically on success — overlapping runs
// would re-fetch the same window and dedupe via the swings UNIQUE.
//
// Auth model: this endpoint is service-role only. The caller (pg_cron via
// pg_net, or an operator script) MUST pass SERVICE_ROLE_KEY in Authorization.
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

import {
  buildHitTraxUrl,
  formatHitTraxDate,
  jsonError,
  jsonOk,
  parseHitTraxTextResponse,
  parseSwingsPayloadStrict,
  readHitTraxConfig,
  type HitTraxConfig,
  type ParsedSwing,
} from "../_shared/hittrax.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// HitTrax content type for swing data. The exact value is contract-dependent
// — set this via `npx supabase secrets set HITTRAX_CONTENT_TYPE=...` per
// the spec's "Content Types: This is a list of data types you can request
// from HitTrax". Defaults to "Swings" until we have the contracted value.
const HITTRAX_CONTENT_TYPE = Deno.env.get("HITTRAX_CONTENT_TYPE") ?? "Swings";

const POLL_TIMEOUT_MS = 20_000;
const SLACK_SECONDS = 30;        // back EndDate off by 30s to avoid boundary misses
const MAX_LINKS_PER_RUN = 50;    // cap per invocation so a stalled link can't starve others

// Exponential backoff on transient failures. The poller runs every 2 minutes;
// a healthy link is poll-eligible every tick. A failing link's next_poll_at
// is pushed out by min(BACKOFF_BASE_SEC * 2^(retry_count-1), BACKOFF_MAX_SEC),
// so the schedule looks like: 30s → 1m → 2m → 4m → 8m → 16m → 30m (capped).
// Cleared (next_poll_at = NULL, retry_count = 0) on the next success.
const BACKOFF_BASE_SEC = 30;
const BACKOFF_MAX_SEC = 30 * 60;

function backoffSeconds(retryCount: number): number {
  // retryCount is the count AFTER incrementing for this failure.
  const exp = Math.min(retryCount - 1, 30);
  return Math.min(BACKOFF_BASE_SEC * Math.pow(2, exp), BACKOFF_MAX_SEC);
}

async function recordFailure(linkId: string, retryCount: number, error: string): Promise<void> {
  const nextRetry = retryCount + 1;
  const delay = backoffSeconds(nextRetry);
  const nextPollAt = new Date(Date.now() + delay * 1000).toISOString();
  await adminClient
    .from("kid_capture_links")
    .update({
      last_polled_at: new Date().toISOString(),
      last_poll_error: error,
      retry_count: nextRetry,
      next_poll_at: nextPollAt,
    })
    .eq("id", linkId);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type LinkRow = {
  id: string;
  tenant_id: string;
  kid_id: string;
  third_party_user_id: string;
  third_party_user_password: string | null;
  associated_at: string | null;
  last_polled_through: string | null;
  retry_count: number;
};

type PollOutcome = {
  link_id: string;
  ok: boolean;
  swings_inserted: number;
  prs_detected: number;
  error?: string;
};

// Per-push budget. A hung downstream push must not delay cursor advance.
const PUSH_TIMEOUT_MS = 5_000;

// One push per swing-PR EVENT, regardless of how many metrics the swing
// just topped. Task intent (and the trigger) is one PR event per qualifying
// swing — emitting per-metric pushes was a duplicate-notification bug.
// We pick the most exciting metric for the title (priority: exit velo →
// distance → pitch speed) but include all metrics that PR'd in `data` for
// the client to render however it likes.
type PrSummary = {
  metrics: Array<{ metric: string; value: number }>;
};

async function fanOutSwingPrPush(
  parentUserId: string,
  kidFirstName: string,
  pr: PrSummary,
): Promise<void> {
  if (!parentUserId || pr.metrics.length === 0) return;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PUSH_TIMEOUT_MS);
  // Headline metric — first match in priority order, falling back to the
  // first reported metric if no priority match (futureproofing).
  const priority = ["exit_velocity_mph", "distance_ft", "pitch_speed_mph"];
  const headline =
    pr.metrics.find((m) => priority.includes(m.metric)) ?? pr.metrics[0];
  const niceMetric =
    headline.metric === "exit_velocity_mph"
      ? `${Math.round(headline.value)} mph exit velo`
      : headline.metric === "distance_ft"
        ? `${Math.round(headline.value)} ft distance`
        : headline.metric === "pitch_speed_mph"
          ? `${Math.round(headline.value)} mph pitch`
          : `${headline.value}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_ids: [parentUserId],
        title: `New PR! ${niceMetric}`,
        body: `${kidFirstName} just set a personal best.`,
        data: { kind: "swing_pr", metrics: pr.metrics },
      }),
      signal: ac.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error(`hittrax-poll push failed status=${res.status} body=${txt.slice(0, 200)}`);
    }
  } catch (err) {
    console.error("hittrax-poll push error", err);
  } finally {
    clearTimeout(timer);
  }
}

async function pollOneLink(cfg: HitTraxConfig, link: LinkRow, facilityId: string | null): Promise<PollOutcome> {
  const outcome: PollOutcome = { link_id: link.id, ok: false, swings_inserted: 0, prs_detected: 0 };

  if (!link.third_party_user_password) {
    outcome.error = "missing_password";
    await recordFailure(link.id, link.retry_count, "missing_password");
    return outcome;
  }

  const startDate = new Date(link.last_polled_through ?? link.associated_at ?? new Date(Date.now() - 60 * 60 * 1000).toISOString());
  const endDate = new Date(Date.now() - SLACK_SECONDS * 1000);
  if (endDate <= startDate) {
    // Nothing to do this run — note the timestamp and clear any backoff;
    // this is a healthy "empty window" outcome, not a failure.
    await adminClient
      .from("kid_capture_links")
      .update({
        last_polled_at: new Date().toISOString(),
        last_poll_error: null,
        retry_count: 0,
        next_poll_at: null,
      })
      .eq("id", link.id);
    outcome.ok = true;
    return outcome;
  }

  const url = buildHitTraxUrl(cfg, "GetAvailableThirdPartyData", {
    ThirdPartyUserID: link.third_party_user_id,
    ThirdPartyUserPassword: link.third_party_user_password,
    ContentType: HITTRAX_CONTENT_TYPE,
    StartDate: formatHitTraxDate(startDate),
    EndDate: formatHitTraxDate(endDate),
    ...(facilityId ? { FacilityID: facilityId } : {}),
  });

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), POLL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutHandle);
    const code = (err as Error)?.name === "AbortError" ? "hittrax_timeout" : "hittrax_unreachable";
    outcome.error = code;
    await recordFailure(link.id, link.retry_count, code);
    return outcome;
  }
  clearTimeout(timeoutHandle);

  if (!res.ok) {
    outcome.error = `hittrax_status_${res.status}`;
    await recordFailure(link.id, link.retry_count, outcome.error);
    return outcome;
  }
  const bodyText = await res.text();
  // HitTrax may return "Error <reason>" in 200-OK responses (their convention).
  const checkErr = parseHitTraxTextResponse(bodyText);
  if (!checkErr.ok) {
    outcome.error = checkErr.error.slice(0, 200);
    await recordFailure(link.id, link.retry_count, outcome.error);
    return outcome;
  }

  // Strict parser distinguishes "empty window" from "malformed body". A
  // contract-drift / HTML error page / truncated body must NOT advance the
  // cursor — otherwise we'd silently skip every event in this window
  // forever. Treat as a hard poll failure: cursor untouched, error logged.
  const parseResult = parseSwingsPayloadStrict(checkErr.body);
  if (!parseResult.ok) {
    outcome.error = `parse_${parseResult.code}`;
    console.error(
      `hittrax-poll parse failure link=${link.id} code=${parseResult.code} sample=${parseResult.sample}`,
    );
    await recordFailure(link.id, link.retry_count, outcome.error);
    return outcome;
  }
  const swings = parseResult.swings;
  // ANY dropped row is treated as a hard failure: the cursor stays put and
  // we apply backoff, so a partial schema drift never silently skips
  // events. Without this guard, an unparseable row inside a window with
  // valid rows would be permanently lost when last_polled_through advanced
  // past it. Fail-loud is correct here — the next poll re-fetches the same
  // window and the swings UNIQUE absorbs the now-already-stored good rows
  // while we wait for the contract-drift fix to land.
  if (parseResult.dropped > 0) {
    outcome.error = `parse_partial_dropped_count_${parseResult.dropped}_kept_${swings.length}`;
    console.error(
      `hittrax-poll partial parse rejected link=${link.id} kept=${swings.length} dropped=${parseResult.dropped}`,
    );
    await recordFailure(link.id, link.retry_count, outcome.error);
    return outcome;
  }

  // Look up parent + kid name once for push fan-out.
  let parentUserId = "";
  let kidFirstName = "your kid";
  try {
    const { data: kid } = await adminClient
      .from("kids")
      .select("first_name, family_id")
      .eq("id", link.kid_id)
      .maybeSingle();
    if (kid) {
      kidFirstName = kid.first_name ?? kidFirstName;
      const { data: family } = await adminClient
        .from("families")
        .select("parent_user_id")
        .eq("id", kid.family_id)
        .maybeSingle();
      parentUserId = family?.parent_user_id ?? "";
    }
  } catch (e) {
    console.error("hittrax-poll lookup parent failed", e);
  }

  // UPSERT sessions (one per distinct capture_session_id), then UPSERT swings.
  const sessionIdMap = new Map<string, string>(); // hittrax session id -> our uuid
  const distinctSessions = new Map<string, ParsedSwing[]>();
  for (const s of swings) {
    const sid = s.capture_session_id ?? `solo:${s.capture_event_id}`;
    if (!distinctSessions.has(sid)) distinctSessions.set(sid, []);
    distinctSessions.get(sid)!.push(s);
  }

  // Track per-link success. The cursor (last_polled_through) only advances
  // if EVERY upsert in this window succeeded. Partial failure leaves the
  // cursor untouched so the next poll re-fetches the same window — duplicate
  // rows are absorbed by the swings UNIQUE on (capture_source, capture_event_id).
  let allOk = true;
  // Push fan-out is best-effort. We collect every PR push as a promise here
  // and Promise.allSettled them at the end of the link — pushes never block
  // a swing UPSERT and never block cursor advance.
  const pushPromises: Promise<void>[] = [];

  for (const [hittraxSessionId, members] of distinctSessions.entries()) {
    if (!hittraxSessionId.startsWith("solo:")) {
      // Real HitTrax session — UPSERT.
      const startedAt = members.reduce(
        (min, s) => (s.occurred_at < min ? s.occurred_at : min),
        members[0].occurred_at,
      );
      const endedAt = members.reduce(
        (max, s) => (s.occurred_at > max ? s.occurred_at : max),
        members[0].occurred_at,
      );
      const evs = members.map((m) => m.exit_velocity_mph).filter((v): v is number => v != null);
      const dists = members.map((m) => m.distance_ft).filter((v): v is number => v != null);
      const facility = members.find((m) => m.facility_id)?.facility_id ?? null;

      const { data: upserted, error: sessErr } = await adminClient
        .from("sessions")
        .upsert(
          {
            tenant_id: link.tenant_id,
            kid_id: link.kid_id,
            capture_source: "hittrax",
            capture_session_id: hittraxSessionId,
            facility_id: facility,
            started_at: startedAt,
            ended_at: endedAt,
            swing_count: members.length,
            best_exit_velocity_mph: evs.length ? Math.max(...evs) : null,
            avg_exit_velocity_mph: evs.length ? Math.round((evs.reduce((a, b) => a + b, 0) / evs.length) * 10) / 10 : null,
            max_distance_ft: dists.length ? Math.max(...dists) : null,
          },
          { onConflict: "capture_source,capture_session_id" },
        )
        .select("id")
        .single();
      if (sessErr) {
        console.error("hittrax-poll session upsert failed", sessErr);
        allOk = false;
        continue;
      }
      sessionIdMap.set(hittraxSessionId, upserted.id);
    }
  }

  // PR detection in this run = swings that the trigger flips to is_personal_best.
  // We can detect them after-the-fact by selecting back rows with is_personal_best
  // matching our just-inserted ids. To keep things simple, count returned PRs
  // by comparing against the personal_bests table BEFORE insert.
  const beforePbs = new Map<string, number>();
  try {
    const { data: pbs } = await adminClient
      .from("personal_bests")
      .select("metric, value")
      .eq("kid_id", link.kid_id);
    for (const p of pbs ?? []) {
      beforePbs.set(p.metric, Number(p.value));
    }
  } catch (e) {
    console.error("hittrax-poll fetch beforePbs failed", e);
  }

  for (const swing of swings) {
    const hittraxSessionId = swing.capture_session_id ?? null;
    const ourSessionId = hittraxSessionId ? sessionIdMap.get(hittraxSessionId) ?? null : null;
    const { error: insertErr } = await adminClient.from("swings").upsert(
      {
        tenant_id: link.tenant_id,
        kid_id: link.kid_id,
        session_id: ourSessionId,
        capture_source: "hittrax",
        capture_event_id: swing.capture_event_id,
        occurred_at: swing.occurred_at,
        exit_velocity_mph: swing.exit_velocity_mph,
        launch_angle_deg: swing.launch_angle_deg,
        distance_ft: swing.distance_ft,
        contact_quality: swing.contact_quality,
        result: swing.result,
        pitch_speed_mph: swing.pitch_speed_mph,
        spray_angle_deg: swing.spray_angle_deg,
        raw: swing.raw,
      },
      { onConflict: "capture_source,capture_event_id", ignoreDuplicates: false },
    );
    if (insertErr) {
      console.error(`hittrax-poll swing upsert failed event=${swing.capture_event_id}`, insertErr);
      allOk = false;
      continue;
    }
    outcome.swings_inserted++;

    // PR detection (best-effort mirror of the canonical detect_swing_pr
    // trigger). We collapse all metrics this swing topped into ONE push
    // event, matching the ledger semantics: detect_swing_pr writes a
    // single points_ledger row per qualifying swing, so the user sees a
    // single +15 — they should also see a single notification, not three.
    const checks: Array<{ metric: string; value: number | null }> = [
      { metric: "exit_velocity_mph", value: swing.exit_velocity_mph },
      { metric: "distance_ft", value: swing.distance_ft },
      { metric: "pitch_speed_mph", value: swing.pitch_speed_mph },
    ];
    const pr: PrSummary = { metrics: [] };
    for (const c of checks) {
      if (c.value === null) continue;
      const before = beforePbs.get(c.metric);
      if (before === undefined || c.value > before) {
        // Update local cache so a later swing in the same payload doesn't
        // re-detect this metric as a PR.
        beforePbs.set(c.metric, c.value);
        pr.metrics.push({ metric: c.metric, value: c.value });
      }
    }
    if (pr.metrics.length > 0) {
      outcome.prs_detected++;
      // ONE push per swing-PR event regardless of metric count — see
      // fanOutSwingPrPush. Best-effort, never blocks cursor advance.
      pushPromises.push(fanOutSwingPrPush(parentUserId, kidFirstName, pr));
    }
  }

  // Drain push fan-out before returning. Each push has its own 5s timeout,
  // so worst-case wall-clock here is bounded. allSettled means a single
  // push failure doesn't poison the link — failures are already logged
  // inside fanOutPrPush.
  if (pushPromises.length > 0) {
    await Promise.allSettled(pushPromises);
  }

  // Cursor only advances on FULL success. On partial failure we record the
  // failure on the link and leave last_polled_through where it was so the
  // next run re-fetches and the swings UNIQUE absorbs the dupes. Successful
  // polls clear retry_count + next_poll_at so the link returns to "every
  // tick" cadence.
  if (allOk) {
    await adminClient
      .from("kid_capture_links")
      .update({
        last_polled_through: endDate.toISOString(),
        last_polled_at: new Date().toISOString(),
        last_poll_error: null,
        retry_count: 0,
        next_poll_at: null,
      })
      .eq("id", link.id);
    outcome.ok = true;
  } else {
    outcome.error = "partial_upsert_failure";
    await recordFailure(link.id, link.retry_count, outcome.error);
  }
  return outcome;
}

serve(async (req) => {
  const startedAt = Date.now();

  // Service-role auth — same convention as send-push-notification.
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(401, "unauthorized", "Missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return jsonError(401, "unauthorized", "Service role required");
  }

  const cfg = readHitTraxConfig();
  if (!cfg) {
    return jsonError(503, "hittrax_not_configured", "HitTrax credentials not provisioned");
  }

  // Backoff filter: a link is poll-eligible when next_poll_at is NULL
  // (healthy, never-backed-off) OR has elapsed (backoff window expired).
  // PostgREST `.or()` with two clauses keeps the cron tick cheap and lets
  // healthy links continue to poll on every tick while backed-off links
  // wait for their delay to pass. The index on (association_status,
  // next_poll_at NULLS FIRST, last_polled_at NULLS FIRST) added in
  // 20260508070000_v07_hittrax_backoff supports this read pattern.
  const nowIso = new Date().toISOString();
  const { data: links, error: linksErr } = await adminClient
    .from("kid_capture_links")
    .select("id, tenant_id, kid_id, third_party_user_id, third_party_user_password, associated_at, last_polled_through, retry_count")
    .eq("capture_source", "hittrax")
    .eq("association_status", "active")
    .or(`next_poll_at.is.null,next_poll_at.lte.${nowIso}`)
    .order("last_polled_at", { ascending: true, nullsFirst: true })
    .limit(MAX_LINKS_PER_RUN);
  if (linksErr) {
    console.error("hittrax-poll fetch links failed", linksErr);
    return jsonError(500, "db_error", "Failed to fetch active links");
  }

  // Look up hittrax_facility_id once per distinct tenant in a single query.
  const tenantIds = [...new Set((links ?? []).map((l) => l.tenant_id))];
  const facilityIdByTenant = new Map<string, string | null>();
  if (tenantIds.length > 0) {
    const { data: tenantRows, error: tenantsErr } = await adminClient
      .from("tenants")
      .select("id, hittrax_facility_id")
      .in("id", tenantIds);
    if (tenantsErr) {
      // Non-fatal: polling proceeds without FacilityID param (graceful
      // degradation), but we log so operators can catch misconfiguration.
      console.error("hittrax-poll tenant facility_id lookup failed", tenantsErr);
    }
    for (const row of tenantRows ?? []) {
      facilityIdByTenant.set(row.id, row.hittrax_facility_id ?? null);
    }
  }

  const outcomes: PollOutcome[] = [];
  for (const link of links ?? []) {
    const facilityId = facilityIdByTenant.get(link.tenant_id) ?? null;
    const o = await pollOneLink(cfg, link as LinkRow, facilityId);
    outcomes.push(o);
  }

  const totalSwings = outcomes.reduce((a, o) => a + o.swings_inserted, 0);
  const totalPrs = outcomes.reduce((a, o) => a + o.prs_detected, 0);
  const errors = outcomes.filter((o) => !o.ok).length;
  console.log(
    `hittrax-poll links=${outcomes.length} swings=${totalSwings} prs=${totalPrs} errors=${errors} ms=${Date.now() - startedAt}`,
  );

  return jsonOk({ ok: true, outcomes, totals: { links: outcomes.length, swings: totalSwings, prs: totalPrs, errors } });
});
