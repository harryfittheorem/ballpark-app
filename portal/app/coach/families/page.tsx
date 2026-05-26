import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readTenantId, getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import { getStaffFamilyDirectory } from "@/lib/supabase/ownerQueries";
import { StaffFamiliesContent } from "@/components/StaffFamiliesContent";

export const dynamic = "force-dynamic";

export default async function CoachFamiliesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const caps = await getCoachCapabilities(supabase, user.id);
  if (!isStaffPreset(caps)) redirect("/coach");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? "";
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const families = await getStaffFamilyDirectory(supabase, tenantId);

  return <StaffFamiliesContent families={families} />;
}
