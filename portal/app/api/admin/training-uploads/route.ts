/**
 * Admin-only proxy that mints a Mux Direct Upload for a training video
 * (v0.7 task #121). Mirrors `api/coach/drill-uploads` but pinned to
 * app_role='admin' and posts purpose='training' to the Edge Function.
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
  if (readAppRole(session) !== "admin") {
    return clientErr(403, "forbidden", "Only admins can upload training videos.");
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
      body: JSON.stringify({ purpose: "training" }),
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
