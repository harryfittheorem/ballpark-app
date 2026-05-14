/**
 * Owner portal — mint a Mux Direct Upload URL for a coach→family video message.
 *
 * Proxies to the mux-create-upload Edge Function with purpose='coach_message'.
 * The Edge Function was extended (20260514) to accept app_role='owner' in
 * addition to 'coach' for this purpose.
 *
 * The videos row is inserted by the Edge Function using the SERVICE ROLE, with
 * uploaded_by_user_id = owner's user id (the portal user). The coach_messages
 * INSERT (POST /api/owner/coach-messages) uses the service role to bypass RLS
 * and pin sender_user_id to the selected coach's user_id.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EdgeOk = { upload_url: string; video_id: string };
type EdgeErr = { error?: { code?: string; message?: string } };

function clientErr(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return clientErr(401, "unauthorized", "Sign in again to upload.");
  }
  const role = readAppRole(session);
  if (role !== "owner" && role !== "super_admin") {
    return clientErr(403, "forbidden", "Owner role required.");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return clientErr(500, "config_error", "Server is missing NEXT_PUBLIC_SUPABASE_URL.");
  }

  const idempotencyKey = crypto.randomUUID();

  let edgeRes: Response;
  try {
    edgeRes = await fetch(`${url}/functions/v1/mux-create-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ purpose: "coach_message" }),
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    return clientErr(502, "edge_unreachable", `Could not reach upload service: ${msg}`);
  }

  const text = await edgeRes.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return clientErr(502, "edge_bad_response", `Upload service returned non-JSON (status ${edgeRes.status}).`);
  }

  if (!edgeRes.ok) {
    const e = (parsed as EdgeErr | null)?.error;
    return clientErr(
      edgeRes.status >= 500 ? 502 : edgeRes.status,
      e?.code ?? "edge_error",
      e?.message ?? `Upload service returned status ${edgeRes.status}.`,
    );
  }

  const ok = parsed as EdgeOk | null;
  if (!ok?.upload_url || !ok?.video_id) {
    return clientErr(502, "edge_bad_response", "Upload service response was missing upload_url or video_id.");
  }

  return NextResponse.json(
    { upload_url: ok.upload_url, video_id: ok.video_id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
