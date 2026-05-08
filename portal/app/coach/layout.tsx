import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Verified auth check (validates JWT with Supabase). Middleware also
  // gates /coach/* but layouts re-check as defence in depth.
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
    // Parent (or unknown role) — bounce through the logout route so the
    // session cookie is actually cleared (Server Components can't write
    // cookies; Route Handlers can).
    redirect("/logout?reason=parent");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader email={user.email ?? null} role="coach" />
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  );
}
