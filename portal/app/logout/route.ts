import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign-out endpoint. Implemented as a Route Handler (not invoked from a
 * Server Component) because cookie writes are only allowed in Route
 * Handlers and Server Actions. Layouts that need to evict a session
 * (e.g. a parent who reached a coach/admin route) `redirect()` here.
 *
 * `?reason=parent` is preserved so the login screen can show the
 * "this portal is for coaches and admins" message after the redirect.
 */
async function handler(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "signedout";
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

export const GET = handler;
export const POST = handler;
