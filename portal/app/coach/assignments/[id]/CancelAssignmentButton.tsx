"use client";

import { useFormStatus } from "react-dom";
import { cancelAssignment } from "./edit/actions";

function ConfirmingButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (
          !window.confirm(
            "Cancel this assignment? The family will no longer see it. This cannot be undone.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="inline-flex shrink-0 items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Cancelling…" : "Cancel assignment"}
    </button>
  );
}

export function CancelAssignmentButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  return (
    <form action={cancelAssignment}>
      <input type="hidden" name="assignment_id" value={assignmentId} />
      <ConfirmingButton />
    </form>
  );
}
