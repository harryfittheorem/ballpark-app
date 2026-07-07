"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, type AppRole } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?reason=missing");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    redirect("/login?reason=invalid");
  }

  // Primary: read app_role from the JWT custom claim (injected by the
  // Custom Access Token Hook). Fallback: read from user_metadata, which
  // is always present even when the hook hasn't fired yet (e.g. first
  // login after metadata was patched but before a token refresh).
  let role = readAppRole(data.session);

  if (role === "parent") {
    const metaRole = data.user?.user_metadata?.app_role as string | undefined;
    const validRoles: AppRole[] = ["owner", "admin", "coach", "super_admin"];
    if (metaRole && validRoles.includes(metaRole as AppRole)) {
      role = metaRole as AppRole;
    }
  }

  if (role === "parent") {
    // Parents are not allowed in the portal. Drop the session and bounce
    // them back to /login with a friendly message.
    await supabase.auth.signOut();
    redirect("/login?reason=parent");
  }

  if (role === "admin") redirect("/admin");
  if (role === "owner") redirect("/owner/dashboard");
  if (role === "super_admin") redirect("/hq");
  redirect("/coach/inbox");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
