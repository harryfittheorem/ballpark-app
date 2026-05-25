import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, type AppRole } from "@/lib/auth";
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

  // readAppRole decodes the JWT access token. In production the token may
  // predate the Custom Access Token Hook, so fall back to app_metadata
  // (set server-side, always present on the verified getUser() result).
  let role = readAppRole(session);
  if (role === "parent" && user.app_metadata?.app_role) {
    const meta = user.app_metadata.app_role as string;
    const known: AppRole[] = ["owner", "admin", "super_admin", "coach", "parent"];
    if (known.includes(meta as AppRole)) role = meta as AppRole;
  }

  if (role === "coach") redirect("/coach/inbox");
  if (role !== "admin" && role !== "owner" && role !== "super_admin") {
    redirect("/logout?reason=parent");
  }

  return (
    <PortalShell role={role === "owner" ? "owner" : "admin"} email={user.email ?? null}>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </PortalShell>
  );
}
