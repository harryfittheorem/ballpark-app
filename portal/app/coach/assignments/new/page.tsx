import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "./AssignmentForm";
import { Card } from "@/components/ui/Card";

type Kid = {
  id: string;
  first_name: string;
  last_name: string;
};

type DrillVideo = {
  id: string;
  title: string | null;
  created_at: string;
};

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [kidsRes, videosRes] = await Promise.all([
    supabase
      .from("kids")
      .select("id, first_name, last_name")
      .order("first_name", { ascending: true }),
    supabase
      .from("videos")
      .select("id, title, created_at")
      .eq("uploaded_by_user_id", user!.id)
      .eq("purpose", "drill")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const kids = (kidsRes.data ?? []) as Kid[];
  const videos = (videosRes.data ?? []) as DrillVideo[];
  const { error: errParam } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
            New assignment
          </h1>
          <p className="mt-1 text-sm text-text-light">
            Send a drill to one of your families.
          </p>
        </div>
        <Link
          href="/coach/assignments"
          className="text-sm text-text-light transition-colors hover:text-gold"
        >
          ← Back
        </Link>
      </div>

      {errParam ? (
        <Card padding="sm" className="border-danger/40 bg-danger-bg">
          <p className="text-sm text-danger">{errParam}</p>
        </Card>
      ) : null}

      {kids.length === 0 ? (
        <Card padding="lg" className="border-dashed text-center">
          <p className="text-sm text-text-light">
            There are no kids in your tenant yet, so there&apos;s no one to
            assign a drill to.
          </p>
        </Card>
      ) : (
        <AssignmentForm kids={kids} recentVideos={videos} />
      )}
    </div>
  );
}
