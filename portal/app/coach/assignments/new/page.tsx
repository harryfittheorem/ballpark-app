import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssignmentForm } from "./AssignmentForm";

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
          <h1 className="text-2xl font-semibold tracking-tight">
            New assignment
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Send a drill to one of your families.
          </p>
        </div>
        <Link
          href="/coach/assignments"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back
        </Link>
      </div>

      {errParam ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errParam}
        </div>
      ) : null}

      {kids.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          There are no kids in your tenant yet, so there&apos;s no one to
          assign a drill to.
        </div>
      ) : (
        <AssignmentForm kids={kids} recentVideos={videos} />
      )}
    </div>
  );
}
