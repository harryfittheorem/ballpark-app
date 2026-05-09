"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import { createTrainingVideo } from "../actions";
import { TrainingVideoUploadField } from "./TrainingVideoUploadField";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <Button type="submit" disabled={isDisabled}>
      {pending ? "Saving…" : "Save video"}
    </Button>
  );
}

export function TrainingVideoForm() {
  const [uploadBusy, setUploadBusy] = useState(false);

  return (
    <Card accent padding="lg">
      <form action={createTrainingVideo} className="space-y-5">
        <Input
          id="title"
          name="title"
          type="text"
          required
          maxLength={140}
          placeholder="e.g. Tee work fundamentals"
          label="Title"
        />

        <TextArea
          id="description"
          name="description"
          rows={3}
          placeholder="Short blurb shown on the player screen."
          label="Description"
          optional
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select id="category" name="category" required defaultValue="" label="Category">
            <option value="" disabled>
              Choose…
            </option>
            <option value="hitting">Hitting</option>
            <option value="mental">Mental</option>
            <option value="situational">Situational</option>
            <option value="fielding">Fielding</option>
          </Select>

          <Select id="level" name="level" defaultValue="beginner" label="Level">
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
            placeholder="320"
            label="Duration (seconds)"
            optional
          />
        </div>

        <TrainingVideoUploadField onBusyChange={setUploadBusy} />

        <div className="flex flex-wrap items-center gap-4 border-t border-border-gold pt-4">
          <label className="inline-flex items-center gap-2 text-sm text-cream-light">
            <input type="checkbox" name="featured" className="h-4 w-4 accent-gold" />
            Featured
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-cream-light">
            <input
              type="checkbox"
              name="publish_now"
              defaultChecked
              className="h-4 w-4 accent-gold"
            />
            Publish immediately
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border-gold pt-5">
          {uploadBusy ? (
            <span className="text-xs text-text-light">
              Waiting for upload + Mux to finish…
            </span>
          ) : null}
          <SubmitButton disabled={uploadBusy} />
        </div>
      </form>
    </Card>
  );
}
