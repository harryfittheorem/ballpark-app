import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditAssignmentForm } from "./EditAssignmentForm";

type DrillVideo =
  | { id: string; title: string | null }
  | { id: string; title: string | null }[]
  | null;

type Kid =
  | { first_name: string; last_name: string }
  | { first_name: string; last_name: string }[]
  | null;

type Row = {
  id: string;
  tenant_id: string;
  coach_user_id: string;
  status: "pending" | "submitted" | "reviewed";
  title: string;
  description: string | null;
  due_date: string | null;
  drill_video_id: string | null;
  kid: Kid;
  drill_video: DrillVideo;
};

type RecentVideo = {
  id: string;
  title: string | null;
  created_at: string;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default async function EditAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errParam } = await searchParams;
  const supabase = await createClient();

  const [{ data, error }, { data: { user } }] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        "id, tenant_id, coach_user_id, status, title, description, due_date, drill_video_id, kid:kid_id(first_name, last_name), drill_video:drill_video_id(id, title)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Failed to load assignment: {error.message}
      </div>
    );
  }
  if (!data) notFound();

  const row = data as Row;

  // Bounce if the caller is not the original author or the row is no longer
  // editable. Server Action re-checks both, but redirecting early avoids
  // rendering a form that would just bounce back with an error.
  if (!user || row.coach_user_id !== user.id) {
    redirect(`/coach/assignments/${id}?error=${encodeURIComponent(
      "Only the assigning coach can edit this drill.",
    )}`);
  }
  if (row.status !== "pending") {
    redirect(`/coach/assignments/${id}?error=${encodeURIComponent(
      "This assignment can no longer be edited.",
    )}`);
  }

  const { data: recent } = await supabase
    .from("videos")
    .select("id, title, created_at")
    .eq("uploaded_by_user_id", user.id)
    .eq("purpose", "drill")
    .order("created_at", { ascending: false })
    .limit(20);

  const recentVideos = (recent ?? []) as RecentVideo[];
  const kid = pickOne(row.kid);
  const currentVideo = pickOne(row.drill_video);
  const kidName = kid ? `${kid.first_name} ${kid.last_name}` : "Unknown kid";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit assignment
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Fix a typo or swap the drill video before the family marks it
            done.
          </p>
        </div>
        <Link
          href={`/coach/assignments/${id}`}
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

      <EditAssignmentForm
        initial={{
          id: row.id,
          title: row.title,
          description: row.description,
          due_date: row.due_date,
          drill_video_id: row.drill_video_id,
          current_drill_video: currentVideo,
        }}
        recentVideos={recentVideos}
        kidName={kidName}
      />
    </div>
  );
}
