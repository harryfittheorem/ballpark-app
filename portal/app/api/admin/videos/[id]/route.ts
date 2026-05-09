/**
 * Admin-only "is my upload ready yet?" lookup. Returns the videos row's
 * mux_playback_id + status so the new-training-video form can poll
 * after a Mux Direct Upload finishes (v0.7 task #121).
 *
 * RLS on `videos` already restricts admins to their tenant; this route
 * just adds the role gate so a parent can't reach the endpoint at all.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (readAppRole(session) !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("videos")
    .select("id, status, mux_playback_id, duration_seconds")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
