import Link from "next/link";
import { signIn } from "./actions";

const REASON_MESSAGES: Record<string, string> = {
  parent:
    "This portal is for coaches and admins. Parents please use the mobile app.",
  invalid: "Email or password is incorrect.",
  missing: "Please enter both email and password.",
  unauthenticated: "Please sign in to continue.",
  signedout: "You have been signed out.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const message = reason ? REASON_MESSAGES[reason] : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ballpark Portal
          </h1>
          <p className="text-sm text-slate-600">
            Sign in to access the coach + admin tools.
          </p>
        </div>

        {message ? (
          <div
            role="alert"
            className={
              reason === "signedout"
                ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                : "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            }
          >
            {message}
          </div>
        ) : null}

        <form action={signIn} className="space-y-4">
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            Sign in
          </button>
        </form>

        <p className="text-center text-xs text-slate-500">
          Parents — open the Ballpark mobile app instead.{" "}
          <Link href="/" className="underline">
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
