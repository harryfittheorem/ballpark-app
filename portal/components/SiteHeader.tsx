import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

export function SiteHeader({
  email,
  role,
}: {
  email: string | null;
  role: "coach" | "admin";
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href={role === "admin" ? "/admin" : "/coach/inbox"}>
            <span className="text-base font-semibold tracking-tight">
              Ballpark Portal
            </span>
          </Link>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600">
            {role}
          </span>
          {role === "coach" ? (
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/coach/inbox"
                className="text-slate-600 hover:text-slate-900"
              >
                Inbox
              </Link>
              <Link
                href="/coach/assignments"
                className="text-slate-600 hover:text-slate-900"
              >
                Assignments
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {email ? (
            <span className="hidden text-xs text-slate-500 sm:inline">
              {email}
            </span>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
