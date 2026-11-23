import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = readAppRole(session);

  if (role === "admin") redirect("/admin");
  if (role !== "coach") {
    redirect("/logout?reason=parent");
  }

  const caps = await getCoachCapabilities(supabase, user.id);
  const isStaff = isStaffPreset(caps);

  // Load owner's staff access config to apply nav visibility overrides.
  let staffAccessConfig: { instructor?: string[]; staff?: string[] } | null = null;
  try {
    const coachRow = await supabase.from('coaches').select('tenant_id').eq('user_id', user.id).maybeSingle();
    if (coachRow.data?.tenant_id) {
      const tenantRow = await supabase.from('tenants').select('staff_access_config').eq('id', coachRow.data.tenant_id).maybeSingle();
      if (tenantRow.data?.staff_access_config) {
        staffAccessConfig = tenantRow.data.staff_access_config as typeof staffAccessConfig;
      }
    }
  } catch { /* non-fatal */ }

  return (
    <PortalShell role="coach" email={user.email ?? null} isStaff={isStaff} staffAccessConfig={staffAccessConfig}>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </PortalShell>
  );
}
