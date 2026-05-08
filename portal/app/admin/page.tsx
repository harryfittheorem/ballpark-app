import { Card } from "@/components/ui/Card";

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

      <Card accent padding="lg" className="border-dashed text-center">
        <p className="text-sm text-cream-light">
          Admin features coming in v0.8.
        </p>
        <p className="mt-2 text-xs text-text-light">
          The auth gate around this page is the proof the role check works.
        </p>
      </Card>
    </div>
  );
}
