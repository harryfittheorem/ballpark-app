/**
 * /admin/waivers — family waiver status dashboard.
 *
 * Shows every family in the tenant with their signed / unsigned / outdated
 * status for the active waiver version. Includes filter controls and CSV
 * export (handled in the WaiversClient island).
 *
 * Uses the service-role client for family_waivers reads so tenant-admin
 * RLS policies don't need to cover this cross-family read path.
 */

import { redirect } from "next/navigation";

import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

import { WaiversClient, type WaiverRow } from "./WaiversClient";

export default async function WaiversPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") redirect("/logout?reason=forbidden");

  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  // Use service client for cross-family reads (bypasses RLS)
  const svc = createServiceClient();

  // Active waiver for this tenant
  const { data: activeWaiver } = await svc
    .from("waivers")
    .select("id, version")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  // All families in this tenant
  const { data: families } = await svc
    .from("families")
    .select("id, parent_first_name, parent_last_name, parent_email")
    .eq("tenant_id", tenantId)
    .order("parent_last_name", { ascending: true });

  // All family_waivers records for the active waiver
  const { data: activeSignedRecords } =
    activeWaiver
      ? await svc
          .from("family_waivers")
          .select("family_id, signed_at, app_version, waiver:waiver_id(version)")
          .eq("waiver_id", activeWaiver.id)
      : { data: [] };

  // All other (older) waiver ids for this tenant — to detect "outdated" families
  const { data: allWaivers } = await svc
    .from("waivers")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_active", false);

  const oldWaiverIds = (allWaivers ?? []).map((w) => w.id);

  const { data: oldSignedRecords } =
    oldWaiverIds.length > 0
      ? await svc
          .from("family_waivers")
          .select("family_id")
          .in("waiver_id", oldWaiverIds)
      : { data: [] };

  type SignedRecord = {
    family_id: string;
    signed_at: string;
    app_version: string | null;
    waiver: { version: number } | null;
  };

  const activeSignedMap = new Map<string, SignedRecord>();
  for (const r of activeSignedRecords ?? []) {
    const rec = r as unknown as SignedRecord;
    activeSignedMap.set(rec.family_id, rec);
  }

  const oldSignedFamilyIds = new Set<string>(
    (oldSignedRecords ?? []).map(
      (r) => (r as unknown as { family_id: string }).family_id,
    ),
  );

  const rows: WaiverRow[] = (families ?? []).map((f) => {
    const activeSigned = activeSignedMap.get(f.id);
    let status: WaiverRow["status"];
    if (activeSigned) {
      status = "signed";
    } else if (oldSignedFamilyIds.has(f.id)) {
      status = "outdated";
    } else {
      status = "unsigned";
    }

    return {
      family_id: f.id,
      parent_first_name: f.parent_first_name,
      parent_last_name: f.parent_last_name,
      parent_email: f.parent_email,
      signed_at: activeSigned?.signed_at ?? null,
      app_version: activeSigned?.app_version ?? null,
      waiver_version: activeSigned?.waiver?.version ?? null,
      status,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Waivers
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Liability waiver status for every family in your tenant.
          {activeWaiver
            ? ` Active version: v${activeWaiver.version}.`
            : " No active waiver is configured."}
        </p>
      </div>

      <WaiversClient
        rows={rows}
        activeVersion={activeWaiver?.version ?? null}
      />
    </div>
  );
}
