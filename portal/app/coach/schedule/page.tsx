import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readTenantId } from "@/lib/auth";
import { getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import { getOwnerScheduleData } from "@/lib/supabase/ownerQueries";
import { ScheduleContent } from "@/app/owner/schedule/ScheduleContent";

export const dynamic = "force-dynamic";

export default async function CoachSchedulePage() {
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

  const data = await getOwnerScheduleData(supabase, tenantId);

  return <ScheduleContent data={data} tenantId={tenantId} />;
}
