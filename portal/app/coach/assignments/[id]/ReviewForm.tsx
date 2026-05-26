"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  reviewAssignment,
  type ReviewFormState,
} from "./review-actions";
import { fieldClasses } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const INITIAL: ReviewFormState = { error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending ? "Saving…" : "Submit review"}
    </Button>
  );
}

export function ReviewForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction] = useActionState(reviewAssignment, INITIAL);
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");

  const canSubmit = rating >= 1 && rating <= 5 && feedback.trim().length >= 10;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <input type="hidden" name="rating" value={rating} />

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
          Rating
        </label>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= rating;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                onClick={() => setRating(n)}
                className={`flex h-10 w-10 items-center justify-center rounded-md border text-2xl leading-none transition-colors ${
                  active
                    ? "border-gold bg-gold/10 text-gold"
                    : "border-border-gold bg-surface text-text-light/40 hover:border-gold/60"
                }`}
              >
                {active ? "★" : "☆"}
              </button>
            );
          })}
          <span className="ml-3 text-sm text-text-light">
            {rating > 0 ? `${rating} / 5` : "Select a rating"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="feedback"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
        >
          Feedback
        </label>
        <textarea
          id="feedback"
          name="feedback"
          rows={5}
          minLength={10}
          maxLength={2000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What did they do well? What should they work on next?"
          className={fieldClasses()}
          required
        />
        <p className="text-xs text-text-light">
          {feedback.trim().length} characters (min 10)
        </p>
      </div>

      {state.error ? (
        <div className="rounded-md border border-danger/40 bg-danger-bg p-3 text-sm text-danger">
          {state.error}
        </div>
      ) : null}

      <SubmitButton disabled={!canSubmit} />
    </form>
  );
}
