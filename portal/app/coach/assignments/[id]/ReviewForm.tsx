"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  reviewAssignment,
  type ReviewFormState,
} from "./review-actions";

const INITIAL: ReviewFormState = { error: null };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? "Saving…" : "Submit review"}
    </button>
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
        <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
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
                    ? "border-amber-400 bg-amber-50 text-amber-500"
                    : "border-slate-200 bg-white text-slate-300 hover:border-slate-300"
                }`}
              >
                {active ? "★" : "☆"}
              </button>
            );
          })}
          <span className="ml-3 text-sm text-slate-500">
            {rating > 0 ? `${rating} / 5` : "Select a rating"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="feedback"
          className="block text-xs font-medium uppercase tracking-wide text-slate-500"
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
          className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          required
        />
        <p className="text-xs text-slate-500">
          {feedback.trim().length} characters (min 10)
        </p>
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </div>
      ) : null}

      <SubmitButton disabled={!canSubmit} />
    </form>
  );
}
