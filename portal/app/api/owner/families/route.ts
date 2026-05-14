/**
 * Owner portal — list families + kids in this tenant for the coach message
 * recipient picker. Uses the owner's session client so RLS (families_owner_select,
 * kids_owner_select) filters results to the owner's tenant automatically.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type FamilyRecipient = {
  familyId: string;
  parentName: string;
  kids: { kidId: string; kidName: string }[];
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = readAppRole(session);
  if (role !== "owner" && role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const tenantId = readTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "no_tenant" }, { status: 403 });
  }

  const { data: families, error: famErr } = await supabase
    .from("families")
    .select("id, parent_first_name, parent_last_name")
    .eq("tenant_id", tenantId)
    .order("parent_last_name", { ascending: true });

  if (famErr) {
    return NextResponse.json({ error: famErr.message }, { status: 500 });
  }

  const familyIds = (families ?? []).map((f) => f.id);
  const { data: kids, error: kidsErr } = familyIds.length
    ? await supabase
        .from("kids")
        .select("id, family_id, first_name, last_name")
        .in("family_id", familyIds)
        .order("first_name", { ascending: true })
    : { data: [], error: null };

  if (kidsErr) {
    return NextResponse.json({ error: kidsErr.message }, { status: 500 });
  }

  const kidsByFamily: Record<string, { kidId: string; kidName: string }[]> = {};
  for (const k of kids ?? []) {
    if (!kidsByFamily[k.family_id]) kidsByFamily[k.family_id] = [];
    kidsByFamily[k.family_id].push({
      kidId: k.id,
      kidName: [k.first_name, k.last_name].filter(Boolean).join(" "),
    });
  }

  const result: FamilyRecipient[] = (families ?? [])
    .map((f) => ({
      familyId: f.id,
      parentName: [f.parent_first_name, f.parent_last_name].filter(Boolean).join(" "),
      kids: kidsByFamily[f.id] ?? [],
    }))
    .filter((f) => f.kids.length > 0);

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
