"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createAssignment } from "./actions";
import { DrillVideoField } from "./DrillVideoField";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";

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
    <Button type="submit" disabled={isDisabled}>
      {pending ? "Creating…" : "Create assignment"}
    </Button>
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
    <Card accent padding="lg">
      <form action={createAssignment} className="space-y-5">
        <Select
          id="kid_id"
          name="kid_id"
          required
          defaultValue=""
          label="Recipient kid"
        >
          <option value="" disabled>
            Choose a kid…
          </option>
          {kids.map((k) => (
            <option key={k.id} value={k.id}>
              {k.first_name} {k.last_name}
            </option>
          ))}
        </Select>

        <Input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          placeholder="e.g. 50 tee swings, top hand only"
          label="Drill title"
        />

        <TextArea
          id="description"
          name="description"
          required
          rows={4}
          placeholder="What should they do, how many reps, focus cues, etc."
          label="Drill description"
        />

        <DrillVideoField recent={recentVideos} onBusyChange={setUploadBusy} />

        <Input
          id="due_date"
          name="due_date"
          type="date"
          label="Due date"
          optional
        />

        <div className="flex items-center justify-end gap-3 border-t border-border-gold pt-5">
          {uploadBusy ? (
            <span className="text-xs text-text-light">
              Waiting for video upload to finish…
            </span>
          ) : null}
          <Link
            href="/coach/assignments"
            className="text-sm text-text-light transition-colors hover:text-gold"
          >
            Cancel
          </Link>
          <SubmitButton disabled={uploadBusy} />
        </div>
      </form>
    </Card>
  );
}
