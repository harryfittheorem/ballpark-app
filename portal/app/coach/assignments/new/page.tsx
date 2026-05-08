import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAssignment } from "./actions";

type Kid = {
  id: string;
  first_name: string;
  last_name: string;
  family_id: string;
};

type DrillVideo = {
  id: string;
  title: string | null;
  created_at: string;
};

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365)
    return RTF.format(Math.round(diffSec / (86400 * 30)), "month");
  return RTF.format(Math.round(diffSec / (86400 * 365)), "year");
}

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
      .select("id, first_name, last_name, family_id")
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
        <form
          action={createAssignment}
          className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
        >
          <div className="space-y-1">
            <label
              htmlFor="kid_id"
              className="block text-sm font-medium text-slate-900"
            >
              Recipient kid
            </label>
            <select
              id="kid_id"
              name="kid_id"
              required
              defaultValue=""
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="" disabled>
                Choose a kid…
              </option>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.first_name} {k.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-900"
            >
              Drill title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={120}
              placeholder="e.g. 50 tee swings, top hand only"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-900"
            >
              Drill description
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={4}
              placeholder="What should they do, how many reps, focus cues, etc."
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="drill_video_id"
              className="block text-sm font-medium text-slate-900"
            >
              Drill video{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            {videos.length > 0 ? (
              <select
                id="drill_video_id"
                name="drill_video_id"
                defaultValue=""
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="">No video / link later</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {(v.title?.trim() || "Untitled drill") +
                      " • " +
                      relativeTime(v.created_at)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="drill_video_id"
                name="drill_video_id"
                type="text"
                placeholder="UUID of an existing video (or leave blank)"
                pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
            )}
            <p className="text-xs text-slate-500">
              {videos.length > 0
                ? "Pick from your last 20 drill videos uploaded via the mobile app."
                : "You haven\u2019t uploaded any drill videos yet. Paste an existing video id or leave blank."}
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="due_date"
              className="block text-sm font-medium text-slate-900"
            >
              Due date{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="due_date"
              name="due_date"
              type="date"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Link
              href="/coach/assignments"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Create assignment
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
