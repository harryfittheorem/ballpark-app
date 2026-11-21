/**
 * Owner portal — insert a coach→family message on behalf of a coach.
 *
 * Uses the SERVICE ROLE client to bypass RLS so the owner can write
 * coach_messages with sender_user_id = the selected coach's auth user_id
 * (not the owner's own user_id).
 *
 * Required body:
 *   coachUserId    string  — auth.users UUID of the sending coach
 *   familyId       string  — recipient family UUID
 *   kidId          string  — recipient kid UUID
 *   tenantId       string  — tenant UUID (double-checked against JWT claim)
 *   videoId?       string  — optional videos row UUID (already uploaded via Mux)
 *   messageText?   string  — optional text body (required when videoId is omitted)
 */
import { NextResponse } from "next/server";
import { instructorMessagingApproved, instructorMessagingGate } from "@/lib/coachingMessaging";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { readAppRole, readTenantId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientErr(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  // No service-role bypass of the R07 communication policy.
  if (!instructorMessagingApproved()) return clientErr(403, "policy_required", instructorMessagingGate);
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return clientErr(401, "unauthorized", "Sign in again.");
  }
  const role = readAppRole(session);
  if (role !== "owner" && role !== "super_admin") {
    return clientErr(403, "forbidden", "Owner role required.");
  }
  const jwtTenantId = readTenantId(session);
  if (!jwtTenantId) {
    return clientErr(403, "no_tenant", "No tenant in session.");
  }

  let body: {
    coachUserId?: string;
    familyId?: string;
    kidId?: string;
    tenantId?: string;
    videoId?: string | null;
    messageText?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return clientErr(400, "bad_request", "Invalid JSON body.");
  }

  const { coachUserId, familyId, kidId, tenantId, videoId, messageText } = body;

  if (!coachUserId || !familyId || !kidId || !tenantId) {
    return clientErr(400, "bad_request", "coachUserId, familyId, kidId, tenantId are required.");
  }
  if (tenantId !== jwtTenantId) {
    return clientErr(403, "tenant_mismatch", "tenantId does not match your session.");
  }
  if (!videoId && !messageText?.trim()) {
    return clientErr(400, "bad_request", "Provide a video, a message, or both.");
  }

  const service = createServiceClient();

  const { data, error } = await service
    .from("coach_messages")
    .insert({
      tenant_id: tenantId,
      sender_user_id: coachUserId,
      recipient_family_id: familyId,
      recipient_kid_id: kidId,
      video_id: videoId ?? null,
      message_text: messageText?.trim() || null,
      recipient_coach_user_id: null,
      label: null,
      sender_display: null,
    })
    .select("id")
    .single();

  if (error) {
    return clientErr(500, "db_error", error.message);
  }

  return NextResponse.json(
    { id: data.id },
    { headers: { "Cache-Control": "no-store" } },
  );
}
