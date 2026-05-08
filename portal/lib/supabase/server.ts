import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieWrite = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieWrite[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — cookies cannot be set here.
            // The middleware refreshes the session cookie on every request,
            // so missing writes here are harmless.
          }
        },
      },
    },
  );
}
