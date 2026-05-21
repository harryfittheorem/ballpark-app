import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function AdminLayout({
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

  if (role === "coach") redirect("/coach/inbox");
  if (role !== "admin") {
    redirect("/logout?reason=parent");
  }

  return (
    <PortalShell role="admin" email={user.email ?? null}>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </PortalShell>
  );
}
