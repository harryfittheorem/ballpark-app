/**
 * Admin tenant settings page (task #185).
 *
 * Lets operators view and update per-tenant configuration fields —
 * starting with HitTrax Facility ID — without touching secrets or SQL.
 */
import { Card, CardSectionLabel } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { saveFacilityId } from "./actions";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner") redirect("/logout?reason=forbidden");

  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const { data } = await supabase
    .from("tenants")
    .select("name, hittrax_facility_id")
    .eq("id", tenantId)
    .maybeSingle();

  const facilityId = data?.hittrax_facility_id ?? null;
  const tenantName = data?.name ?? null;

  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Tenant Settings
        </h1>
        {tenantName && (
          <p className="mt-1 text-sm text-text-light">{tenantName}</p>
        )}
      </div>

      {saved && (
        <div className="rounded-md border border-success bg-success-bg px-4 py-3 text-sm text-success">
          Settings saved successfully.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      <Card padding="lg" accent>
        <CardSectionLabel>HitTrax Integration</CardSectionLabel>
        <p className="mb-4 text-sm text-text-light">
          The Facility ID scopes data pulls to this franchise location. It is
          passed as the <code className="text-gold">FacilityID</code> query
          parameter in every HitTrax polling request. Leave blank to poll
          without a facility filter.
        </p>

        <form
          action={saveFacilityId}
          className="flex flex-col gap-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label
              htmlFor="hittrax_facility_id"
              className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-light"
            >
              HitTrax Facility ID
            </label>
            <input
              id="hittrax_facility_id"
              name="hittrax_facility_id"
              type="text"
              defaultValue={facilityId ?? ""}
              placeholder="e.g. 6514"
              className="w-full rounded-md border border-border-gold bg-darker px-3 py-2 text-sm text-cream-light placeholder:text-text-muted focus:border-gold focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-dark hover:bg-gold-deep focus:outline-none"
          >
            Save
          </button>
        </form>
      </Card>
    </div>
  );
}
