import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieWrite = { name: string; value: string; options: CookieOptions };

/**
 * Refresh the Supabase session cookie on every request and gate
 * `/coach/*`, `/admin/*`, and `/hq/*` behind authentication. Role-based
 * routing (coach vs admin vs owner vs super_admin) lives in the
 * per-section layouts so we can read the JWT claims server-side once a
 * session exists.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieWrite[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Use getSession() (local cookie read, no network call) instead of getUser()
  // (network call to Supabase auth server). getUser() can fail/timeout in
  // production proxy environments causing spurious unauthenticated redirects.
  // Data-layer security is enforced by Supabase RLS on every query.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const path = request.nextUrl.pathname;
  const protectedPath =
    path.startsWith("/coach") ||
    path.startsWith("/admin") ||
    path.startsWith("/hq") ||
    path.startsWith("/owner");

  if (protectedPath && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "unauthenticated");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
