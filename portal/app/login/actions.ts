"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";

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

  const role = readAppRole(data.session);

  if (role === "parent") {
    // Parents are not allowed in the portal. Drop the session and bounce
    // them back to /login with a friendly message.
    await supabase.auth.signOut();
    redirect("/login?reason=parent");
  }

  if (role === "admin") redirect("/admin");
  redirect("/coach/inbox");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
