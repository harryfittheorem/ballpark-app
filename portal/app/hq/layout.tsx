import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";
import { readAppRole } from "@/lib/auth";
import { HQShell } from "@/components/hq/HQShell";
import type { ReactNode } from "react";

export const metadata = {
  title: "HQ — Ballpark",
};

export default async function HQLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?reason=unauthenticated");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = readAppRole(session);

  if (role !== "super_admin") {
    if (role === "owner") redirect("/owner");
    if (role === "admin") redirect("/admin");
    if (role === "coach") redirect("/coach/inbox");
    redirect("/logout?reason=parent");
  }

  // DB-level verification: confirm a super_admins row actually exists for this
  // user. JWT claims are trusted for routing but the DB row is the authoritative
  // enforcement boundary — protects against stale/tampered tokens.
  const serviceClient = createServiceClient();
  const { data: saRow } = await serviceClient
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!saRow) {
    // JWT says super_admin but no DB row — boot to login.
    redirect("/login?reason=unauthorized");
  }

  return <HQShell email={user.email ?? ""}>{children}</HQShell>;
}
