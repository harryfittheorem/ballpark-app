"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={[
        "relative px-3 py-2 text-sm font-medium transition-colors",
        active ? "text-gold" : "text-text-light hover:text-cream-light",
      ].join(" ")}
    >
      {children}
      <span
        aria-hidden
        className={[
          "absolute inset-x-2 -bottom-[17px] h-0.5 rounded-full transition-all",
          active ? "bg-gold opacity-100" : "bg-gold opacity-0",
        ].join(" ")}
      />
    </Link>
  );
}
