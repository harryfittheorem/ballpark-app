import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TrainingVideoForm } from "./TrainingVideoForm";

export default async function NewTrainingVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          New training video
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Upload a clip via Mux or paste an existing Mux playback id. Save
          as a draft (default) or check Publish to expose it to the tenant
          immediately.
        </p>
      </div>

      {sp.error ? (
        <Card padding="md" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      ) : null}

      <TrainingVideoForm />

      <Link
        href="/admin/training-videos"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to catalog
      </Link>
    </div>
  );
}
