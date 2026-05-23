import Link from "next/link";

import { Card } from "@/components/ui/Card";

const TILES = [
  {
    href: "/admin/redemptions",
    title: "Redemptions",
    body: "Mark front-desk reward redemptions as fulfilled.",
  },
  {
    href: "/admin/training-videos",
    title: "Training videos",
    body: "Curate the Train tab catalog.",
  },
  {
    href: "/admin/messages",
    title: "Messages",
    body: "View all coach–family messages and videos sent through the app.",
  },
  {
    href: "/admin/waivers",
    title: "Waivers",
    body: "View liability waiver status for every family. Filter by unsigned and export to CSV.",
  },
  {
    href: "/admin/settings",
    title: "Tenant settings",
    body: "Configure per-location settings such as the HitTrax Facility ID.",
  },
  {
    href: "/admin/coaches",
    title: "Coaches",
    body: "Manage coach location assignments across facilities.",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Admin
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Welcome to the admin area.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card padding="lg" accent className="h-full transition hover:border-gold">
              <h2 className="font-display text-xl uppercase tracking-wide text-gold">
                {tile.title}
              </h2>
              <p className="mt-2 text-sm text-text-light">{tile.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
