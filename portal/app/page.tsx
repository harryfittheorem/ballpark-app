import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

export default async function Root() {
  const supabase = await createClient();

  // getUser() validates the JWT against Supabase's auth server (refreshing
  // if needed). Only call getSession() afterwards — at that point the
  // cached session is safe to read for the access_token / app_role claim.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const role = readAppRole(session);

  if (role === "coach") redirect("/coach/inbox");
  if (role === "admin") redirect("/admin");
  if (role === "owner") redirect("/owner");
  // Parent: route through /logout so cookies are actually cleared (a
  // Server Component can't write cookies, a Route Handler can).
  redirect("/logout?reason=parent");
}
