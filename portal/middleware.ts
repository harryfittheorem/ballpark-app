import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  if (request.headers.get("expo-platform")) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;

  // Public booking pages require no authentication.
  if (path.startsWith("/book")) {
    return NextResponse.next();
  }

  // /platform/setup is the one-time bootstrap page — intentionally accessible
  // without authentication. The page itself (and its API route) enforce the
  // platform_init guard server-side on every request. Once initialized, the
  // page redirects to /login so no further middleware action is needed here.
  if (path.startsWith("/platform/setup")) {
    return NextResponse.next();
  }

  // /auth/claim is the invite claim page — accessible without prior auth.
  if (path.startsWith("/auth/claim")) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
