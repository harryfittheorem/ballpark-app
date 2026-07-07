import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "./LoginForm";

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
  const initialError = reason ? REASON_MESSAGES[reason] : undefined;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(241,229,173,0.12),transparent_55%)]"
      />
      <div className="relative w-full max-w-md space-y-6">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_14px_rgba(241,229,173,0.7)]"
            />
            <span className="font-display text-3xl font-semibold uppercase tracking-[0.22em] text-cream-light">
              Ball<span className="text-gold">park</span>
            </span>
          </div>
          <p className="text-sm text-text-light">
            This portal is for coaches and admins.{" "}
            <br />
            Parents please use the mobile app.
          </p>
        </div>

        <Card accent padding="lg" className="space-y-5">
          <LoginForm initialError={initialError} />
        </Card>

        <p className="text-center text-xs text-text-light">
          Parents — open the Ballpark mobile app instead.{" "}
          <Link
            href="/"
            className="text-gold underline-offset-2 hover:underline"
          >
            Home
          </Link>
        </p>
      </div>
    </main>
  );
}
