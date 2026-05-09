"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { createTrainingVideo, updateTrainingVideo } from "../actions";
import { TrainingVideoUploadField } from "./TrainingVideoUploadField";

export type TrainingVideoFormDefaults = {
  id?: string;
  title?: string;
  description?: string | null;
  category?: "hitting" | "mental" | "situational" | "fielding" | "";
  level?: "beginner" | "intermediate" | "advanced";
  coachName?: string | null;
  durationSec?: number | null;
  muxPlaybackId?: string;
  featured?: boolean;
  publishNow?: boolean;
};

function SubmitButton({ disabled, label }: { disabled: boolean; label: string }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <Button type="submit" disabled={isDisabled}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function TrainingVideoForm({
  defaults = {},
  mode = "create",
}: {
  defaults?: TrainingVideoFormDefaults;
  mode?: "create" | "edit";
}) {
  const [uploadBusy, setUploadBusy] = useState(false);
  const action = mode === "edit" ? updateTrainingVideo : createTrainingVideo;

  return (
    <Card accent padding="lg">
      <form action={action} className="space-y-5">
        {mode === "edit" && defaults.id ? (
          <input type="hidden" name="id" value={defaults.id} />
        ) : null}

        <Input
          id="title"
          name="title"
          type="text"
          required
          maxLength={140}
          defaultValue={defaults.title ?? ""}
          placeholder="e.g. Tee work fundamentals"
          label="Title"
        />

        <TextArea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaults.description ?? ""}
          placeholder="Short blurb shown on the player screen."
          label="Description"
          optional
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="category"
            name="category"
            required
            defaultValue={defaults.category ?? ""}
            label="Category"
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="hitting">Hitting</option>
            <option value="mental">Mental</option>
            <option value="situational">Situational</option>
            <option value="fielding">Fielding</option>
          </Select>

          <Select
            id="level"
            name="level"
            defaultValue={defaults.level ?? "beginner"}
            label="Level"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="coach_name"
            name="coach_name"
            type="text"
            defaultValue={defaults.coachName ?? ""}
            placeholder="Coach Mike"
            label="Coach name"
            optional
          />
          <Input
            id="duration_sec"
            name="duration_sec"
            type="number"
            min={0}
            step={1}
            defaultValue={defaults.durationSec ?? ""}
            placeholder="320"
            label="Duration (seconds)"
            optional
          />
        </div>

        <TrainingVideoUploadField
          onBusyChange={setUploadBusy}
          defaultPlaybackId={defaults.muxPlaybackId ?? ""}
        />

        {mode === "create" ? (
          <div className="flex flex-wrap items-center gap-4 border-t border-border-gold pt-4">
            <label className="inline-flex items-center gap-2 text-sm text-cream-light">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={defaults.featured ?? false}
                className="h-4 w-4 accent-gold"
              />
              Featured
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-cream-light">
              <input
                type="checkbox"
                name="publish_now"
                defaultChecked={defaults.publishNow ?? true}
                className="h-4 w-4 accent-gold"
              />
              Publish immediately
            </label>
          </div>
        ) : (
          <p className="border-t border-border-gold pt-4 text-xs text-text-light">
            Use the Publish / Feature buttons in the catalog list to change
            status — this form only edits metadata.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border-gold pt-5">
          {uploadBusy ? (
            <span className="text-xs text-text-light">
              Waiting for upload + Mux to finish…
            </span>
          ) : null}
          <SubmitButton
            disabled={uploadBusy}
            label={mode === "edit" ? "Save changes" : "Save video"}
          />
        </div>
      </form>
    </Card>
  );
}
