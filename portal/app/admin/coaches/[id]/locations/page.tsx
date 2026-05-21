/**
 * Admin page: manage which locations a coach is assigned to.
 *
 * Route: /admin/coaches/[id]/locations
 *
 * Shows:
 *   - Coach name and primary location
 *   - List of currently assigned locations (from coach_locations)
 *   - Add button for locations not yet assigned
 *   - Remove button for each assigned location (except primary if it's the last one)
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardSectionLabel } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { assignCoachToLocation, removeCoachFromLocation } from "./actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; removed?: string }>;
};

export default async function CoachLocationsPage({ params, searchParams }: Props) {
  const { id: coachId } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  // Fetch the coach.
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, first_name, last_name, primary_location_id, is_active")
    .eq("id", coachId)
    .maybeSingle();

  if (!coach) {
    return (
      <div className="space-y-4">
        <Link href="/admin" className="text-sm text-gold hover:underline">
          ← Admin
        </Link>
        <p className="text-sm text-danger">Coach not found.</p>
      </div>
    );
  }

  // Fetch all tenant locations.
  const { data: allLocations } = await supabase
    .from("locations")
    .select("id, name, city, state")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");

  const locations = allLocations ?? [];

  // Fetch currently assigned coach_locations rows.
  const { data: assignedRows } = await supabase
    .from("coach_locations")
    .select("id, location_id, is_primary")
    .eq("coach_id", coachId);

  type AssignedRow = { id: string; location_id: string; is_primary: boolean };
  type LocationRow = { id: string; name: string; city: string | null; state: string | null };

  const assigned: AssignedRow[] = (assignedRows ?? []) as AssignedRow[];
  const assignedLocationIds = new Set(assigned.map((r: AssignedRow) => r.location_id));

  const locRows: LocationRow[] = (locations as LocationRow[]);
  const assignedLocations = locRows.filter((l: LocationRow) => assignedLocationIds.has(l.id));
  const unassignedLocations = locRows.filter((l: LocationRow) => !assignedLocationIds.has(l.id));

  const coachName = `${coach.first_name} ${coach.last_name}`;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const saved = sp.saved === "1";
  const removed = sp.removed === "1";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-light">
        <Link href="/admin" className="hover:text-gold">
          Admin
        </Link>
        <span>/</span>
        <span className="text-cream-light">{coachName} — Locations</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Coach Locations
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {coachName} · {coach.is_active ? "Active" : "Inactive"}
        </p>
      </div>

      {/* Feedback banners */}
      {saved && (
        <div className="rounded-md border border-success bg-success-bg px-4 py-3 text-sm text-success">
          Location assigned successfully.
        </div>
      )}
      {removed && (
        <div className="rounded-md border border-success bg-success-bg px-4 py-3 text-sm text-success">
          Location removed successfully.
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          {errorMsg}
        </div>
      )}

      {/* Currently assigned */}
      <Card padding="lg">
        <CardSectionLabel>Assigned Locations</CardSectionLabel>
        {assignedLocations.length === 0 ? (
          <p className="mt-2 text-sm text-text-light">
            No locations assigned yet. Add one below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {assignedLocations.map((loc: LocationRow) => {
              const isPrimary = loc.id === coach.primary_location_id;
              return (
                <li
                  key={loc.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div>
                    <p className="font-medium text-cream-light">{loc.name}</p>
                    <p className="text-xs text-text-light">
                      {loc.city}, {loc.state}
                      {isPrimary && (
                        <span className="ml-2 rounded bg-gold/20 px-1.5 py-0.5 text-xs font-semibold text-gold">
                          primary
                        </span>
                      )}
                    </p>
                  </div>
                  <form action={removeCoachFromLocation}>
                    <input type="hidden" name="coach_id" value={coachId} />
                    <input type="hidden" name="location_id" value={loc.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-text-light transition hover:border-danger hover:text-danger"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Add a new location */}
      {unassignedLocations.length > 0 && (
        <Card padding="lg">
          <CardSectionLabel>Add Location</CardSectionLabel>
          <form action={assignCoachToLocation} className="mt-3 flex items-end gap-3">
            <input type="hidden" name="coach_id" value={coachId} />
            <div className="flex-1">
              <label
                htmlFor="location_id"
                className="mb-1 block text-xs text-text-light"
              >
                Select a location to assign
              </label>
              <select
                id="location_id"
                name="location_id"
                className="w-full rounded-md border border-border bg-dark px-3 py-2 text-sm text-cream-light focus:border-gold focus:outline-none"
              >
                {unassignedLocations.map((loc: LocationRow) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} — {loc.city}, {loc.state}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-dark transition hover:bg-gold/80"
            >
              Assign
            </button>
          </form>
        </Card>
      )}

      {unassignedLocations.length === 0 && assignedLocations.length > 0 && (
        <p className="text-sm text-text-light">
          This coach is already assigned to all active locations.
        </p>
      )}
    </div>
  );
}
