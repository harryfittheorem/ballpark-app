import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type AppRole = "coach" | "admin" | "owner" | "parent" | "super_admin";

/**
 * Decode the payload of a JWT without verifying its signature. Supabase
 * already verified the signature server-side; we only need to read the
 * `app_role` custom claim injected by the Custom Access Token Hook.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const json =
      typeof Buffer !== "undefined"
        ? Buffer.from(b64, "base64").toString("utf-8")
        : atob(b64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read the `app_role` claim from the access token. Defaults to "parent"
 * for any session whose JWT does not carry the claim — matches the
 * mobile app's behaviour in `src/hooks/useAuth.tsx`.
 *
 * NOTE: the claim is `app_role`, NOT `role` (which is reserved by
 * PostgREST and means SET ROLE).
 */
export function readAppRole(session: Session | null): AppRole {
  if (!session?.access_token) return "parent";
  const payload = decodeJwtPayload(session.access_token);
  const claim = payload?.app_role;
  if (claim === "super_admin") return "super_admin";
  if (claim === "coach") return "coach";
  if (claim === "admin") return "admin";
  if (claim === "owner") return "owner";
  return "parent";
}

/**
 * Read the `tenant_id` claim from the access token. Returns null when
 * there is no session or no claim. Super admins intentionally have no
 * tenant_id claim since they are not scoped to any single tenant.
 *
 * @supabase/ssr does not surface custom JWT claims directly, so we
 * decode the access token payload ourselves (signature already verified
 * by Supabase). Same shape as the mobile app's `useAuth.tsx` decoder,
 * implemented fresh here — never imported from `src/`.
 */
export function readTenantId(session: Session | null): string | null {
  if (!session?.access_token) return null;
  const payload = decodeJwtPayload(session.access_token);
  const claim = payload?.tenant_id;
  return typeof claim === "string" && claim.length > 0 ? claim : null;
}

export type CoachPreset = "instructor" | "staff";

export interface CoachCapabilities {
  preset: CoachPreset;
  [key: string]: unknown;
}

/**
 * Fetch the `capabilities` JSONB for the coach who owns the given user_id.
 * Returns `{ preset: "instructor" }` as the safe default when no row is found
 * or the column is missing/malformed — matching the DB column default.
 *
 * Call server-side only (requires an authenticated Supabase client).
 */
export async function getCoachCapabilities(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoachCapabilities> {
  const fallback: CoachCapabilities = { preset: "instructor" };
  try {
    const { data, error } = await supabase
      .from("coaches")
      .select("capabilities")
      .eq("user_id", userId)
      .single();
    if (error || !data) return fallback;
    const caps = data.capabilities as Record<string, unknown> | null;
    if (!caps || typeof caps !== "object") return fallback;
    const preset = caps.preset;
    if (preset !== "instructor" && preset !== "staff") return fallback;
    return { ...caps, preset } as CoachCapabilities;
  } catch {
    return fallback;
  }
}

/**
 * Convenience check: returns true when the coach has the "staff" preset,
 * granting access to operational portal sections.
 */
export function isStaffPreset(caps: CoachCapabilities): boolean {
  return caps.preset === "staff";
}
