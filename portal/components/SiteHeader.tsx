import Link from "next/link";
import { LogoutButton } from "./LogoutButton";
import { NavLink } from "./NavLink";

export function SiteHeader({
  email,
  role,
}: {
  email: string | null;
  role: "coach" | "admin";
}) {
  return (
    <header className="border-b border-border-gold bg-darker/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <div className="flex items-center gap-6">
          <Link
            href={role === "admin" ? "/admin" : "/coach/inbox"}
            className="group flex items-center gap-2.5"
          >
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-gold shadow-[0_0_12px_rgba(241,229,173,0.7)] transition-transform group-hover:scale-110"
            />
            <span className="font-display text-2xl font-semibold uppercase tracking-[0.18em] text-cream-light">
              Clubhouse<span className="block text-xs text-gold tracking-normal">by Infinite Hitting</span>
            </span>
          </Link>
          <span className="hidden rounded-full border border-border-gold-strong bg-darkest px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold sm:inline-flex">
            {role}
          </span>
          {role === "coach" ? (
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/coach/inbox">Inbox</NavLink>
              <NavLink href="/coach/assignments">Assignments</NavLink>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          {email ? (
            <span className="hidden text-xs text-text-light sm:inline">
              {email}
            </span>
          ) : null}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
