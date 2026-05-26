/**
 * Admin tenant settings page.
 *
 * Lets operators view and update per-tenant configuration fields:
 * - HitTrax Facility ID
 * - Public booking link
 * - Per-location cage rental toggle
 */
import { Card, CardSectionLabel } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { saveFacilityId, toggleCageRental } from "./actions";
import { CopyBookingLink } from "./CopyBookingLink";

type Location = {
  id: string;
  name: string;
  cage_rental_enabled: boolean;
};

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
    .select("name, slug, hittrax_facility_id")
    .eq("id", tenantId)
    .maybeSingle();

  const facilityId = data?.hittrax_facility_id ?? null;
  const tenantName = data?.name ?? null;
  const tenantSlug = data?.slug ?? null;

  // Fetch all locations for this tenant to show cage rental toggles
  const { data: locationsRaw } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("locations")
    .select("id, name, cage_rental_enabled")
    .eq("tenant_id", tenantId)
    .order("name", { ascending: true });

  const locations: Location[] = (locationsRaw ?? []) as Location[];

  // Build the public booking URL from the current request host
  const reqHeaders = await headers();
  const host = reqHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const bookingUrl = tenantSlug
    ? `${protocol}://${host}/book/${tenantSlug}`
    : null;

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

      {bookingUrl && (
        <Card padding="lg" accent>
          <CardSectionLabel>Public Booking Link</CardSectionLabel>
          <p className="mb-4 mt-2 text-sm text-text-light">
            Share this URL so prospective members can browse availability and
            book sessions online — no login required.
          </p>
          <CopyBookingLink url={bookingUrl} />
        </Card>
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

      {locations.length > 0 && (
        <Card padding="lg" accent>
          <CardSectionLabel>Location Settings</CardSectionLabel>
          <p className="mb-4 mt-2 text-sm text-text-light">
            Enable cage rentals per location. When enabled, members see a
            &ldquo;Cage Rentals&rdquo; tab alongside Hitting Lessons in the app.
          </p>
          <div className="space-y-3">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center justify-between rounded-md border border-border bg-darker px-4 py-3"
              >
                <span className="text-sm font-medium text-cream-light">
                  {loc.name}
                </span>
                <form action={toggleCageRental}>
                  <input type="hidden" name="location_id" value={loc.id} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={loc.cage_rental_enabled ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      loc.cage_rental_enabled
                        ? "bg-gold"
                        : "bg-border"
                    }`}
                    role="switch"
                    aria-checked={loc.cage_rental_enabled}
                    aria-label={`Cage rentals for ${loc.name}`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-dark shadow ring-0 transition duration-200 ease-in-out ${
                        loc.cage_rental_enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </form>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
