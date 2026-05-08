import type { Session } from "@supabase/supabase-js";

export type AppRole = "coach" | "admin" | "parent";

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
  if (claim === "coach") return "coach";
  if (claim === "admin") return "admin";
  return "parent";
}

/**
 * Read the `tenant_id` claim from the access token. Returns null when
 * there is no session or no claim. The Custom Access Token Hook on the
 * Supabase project injects `tenant_id` for every authenticated user, so
 * a null return for a signed-in user indicates a misconfigured hook.
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
