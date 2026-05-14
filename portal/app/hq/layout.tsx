import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return <HQShell email={user.email ?? ""}>{children}</HQShell>;
}
