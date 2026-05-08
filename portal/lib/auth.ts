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
