"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createAssignment } from "./actions";
import { DrillVideoField } from "./DrillVideoField";

type Kid = {
  id: string;
  first_name: string;
  last_name: string;
};

type RecentVideo = {
  id: string;
  title: string | null;
  created_at: string;
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
      {pending ? "Creating…" : "Create assignment"}
    </button>
  );
}

export function AssignmentForm({
  kids,
  recentVideos,
}: {
  kids: Kid[];
  recentVideos: RecentVideo[];
}) {
  const [uploadBusy, setUploadBusy] = useState(false);

  return (
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

      <DrillVideoField recent={recentVideos} onBusyChange={setUploadBusy} />

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
        {uploadBusy ? (
          <span className="text-xs text-slate-500">
            Waiting for video upload to finish…
          </span>
        ) : null}
        <Link
          href="/coach/assignments"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
        <SubmitButton disabled={uploadBusy} />
      </div>
    </form>
  );
}
