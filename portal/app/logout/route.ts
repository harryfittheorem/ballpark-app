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
 *
 * URL construction: Replit's proxy routes all external traffic to the
 * portal (port 3000) regardless of the URL port suffix, so
 * `request.nextUrl` can carry a host of `0.0.0.0:5000` (the Expo Metro
 * server port). We use the `x-forwarded-host` / `x-forwarded-proto`
 * headers set by the proxy when available. For direct container access
 * we normalise any raw-IP host to port 3000.
 */
async function handler(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const reason = request.nextUrl.searchParams.get("reason") ?? "signedout";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? "https";

  let loginUrl: URL;

  if (forwardedHost) {
    loginUrl = new URL(
      `/login?reason=${encodeURIComponent(reason)}`,
      `${forwardedProto}://${forwardedHost}`,
    );
  } else {
    const url = request.nextUrl.clone();
    const rawIP = /^(0\.0\.0\.0|127\.0\.0\.1|localhost)$/.test(url.hostname);
    if (rawIP) url.port = "3000";
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("reason", reason);
    loginUrl = url;
  }

  return NextResponse.redirect(loginUrl);
}

export const GET = handler;
export const POST = handler;
