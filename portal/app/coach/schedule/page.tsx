import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCoachCapabilities, isStaffPreset } from "@/lib/auth";
import { SchedulePageContent } from "@/app/owner/schedule/SchedulePageContent";

export const dynamic = "force-dynamic";

export default async function CoachSchedulePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const caps = await getCoachCapabilities(supabase, user.id);
  if (!isStaffPreset(caps)) redirect("/coach");

  return <SchedulePageContent basePath="/coach/schedule" />;
}
