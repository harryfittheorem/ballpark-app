"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DrillVideoField } from "../../new/DrillVideoField";
import { updateAssignment } from "./actions";

type RecentVideo = {
  id: string;
  title: string | null;
  created_at: string;
};

type Initial = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  drill_video_id: string | null;
  current_drill_video: { id: string; title: string | null } | null;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditAssignmentForm({
  initial,
  recentVideos,
  kidName,
}: {
  initial: Initial;
  recentVideos: RecentVideo[];
  kidName: string;
}) {
  const [uploadBusy, setUploadBusy] = useState(false);

  // Stitch the currently-attached drill video into the recent list (deduped)
  // so the "Pick from recent" dropdown can reflect the existing selection
  // even if it's older than the last 20 uploads.
  const mergedRecent: RecentVideo[] = (() => {
    if (
      !initial.current_drill_video ||
      recentVideos.some((v) => v.id === initial.current_drill_video!.id)
    ) {
      return recentVideos;
    }
    return [
      {
        id: initial.current_drill_video.id,
        title: initial.current_drill_video.title,
        created_at: new Date(0).toISOString(),
      },
      ...recentVideos,
    ];
  })();

  return (
    <form
      action={updateAssignment}
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6"
    >
      <input type="hidden" name="assignment_id" value={initial.id} />

      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Editing the drill for{" "}
        <span className="font-medium text-slate-900">{kidName}</span>. The
        recipient cannot be changed — cancel and re-create if you sent it to
        the wrong kid.
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
          defaultValue={initial.title}
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
          defaultValue={initial.description ?? ""}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <DrillVideoField
        recent={mergedRecent}
        onBusyChange={setUploadBusy}
        initialPickedId={initial.drill_video_id ?? ""}
      />

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
          defaultValue={initial.due_date ?? ""}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        {uploadBusy ? (
          <span className="text-xs text-slate-500">
            Waiting for video upload to finish…
          </span>
        ) : null}
        <Link
          href={`/coach/assignments/${initial.id}`}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Discard changes
        </Link>
        <SubmitButton disabled={uploadBusy} />
      </div>
    </form>
  );
}
