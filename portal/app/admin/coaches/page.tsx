/**
 * Admin coaches listing page.
 *
 * Shows all active coaches in the tenant with a link to manage their
 * location assignments.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

type Coach = {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
  is_active: boolean;
  primary_location_id: string | null;
};

type CoachWithLocation = Coach & {
  primary_location_name: string | null;
};

export default async function AdminCoachesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/login?reason=unauthenticated");
  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const { data: coaches } = await supabase
    .from("coaches")
    .select("id, first_name, last_name, specialty, is_active, primary_location_id")
    .eq("tenant_id", tenantId)
    .order("last_name");

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("tenant_id", tenantId);

  type LocRow = { id: string; name: string };
  type CoachRow = { id: string; first_name: string; last_name: string; specialty: string | null; is_active: boolean; primary_location_id: string | null };

  const locationMap = new Map((locations ?? []).map((l: LocRow) => [l.id, l.name]));

  const rows: CoachWithLocation[] = ((coaches ?? []) as CoachRow[]).map((c: CoachRow) => {
    const locName = c.primary_location_id
      ? String(locationMap.get(c.primary_location_id) ?? "")
      : null;
    return { ...c, primary_location_name: locName || null };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-light">
        <Link href="/admin" className="hover:text-gold">
          Admin
        </Link>
        <span>/</span>
        <span className="text-cream-light">Coaches</span>
      </div>

      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Coaches
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Manage coach location assignments.
        </p>
      </div>

      <Card padding="lg">
        {rows.length === 0 ? (
          <p className="text-sm text-text-light">No coaches found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((coach) => (
              <li
                key={coach.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-medium text-cream-light">
                    {coach.first_name} {coach.last_name}
                    {!coach.is_active && (
                      <span className="ml-2 text-xs text-text-muted">(inactive)</span>
                    )}
                  </p>
                  <p className="text-xs text-text-light">
                    {coach.primary_location_name
                      ? `Primary: ${coach.primary_location_name}`
                      : "No primary location"}
                    {coach.specialty ? ` · ${coach.specialty}` : ""}
                  </p>
                </div>
                <Link
                  href={`/admin/coaches/${coach.id}/locations`}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-text-light transition hover:border-gold hover:text-gold"
                >
                  Manage locations
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
