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

  return (
    <PortalShell role="coach" email={user.email ?? null} isStaff={isStaff}>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </PortalShell>
  );
}
