"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { replyToThread } from "./actions";

export function InboxReplyForm({ kidId }: { kidId: string }) {
  const [pending, startTransition] = useTransition();
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = textareaRef.current?.value?.trim();
    if (!text) return;

    setSendError(null);

    // Optimistically clear the textarea; restore if the action fails.
    if (textareaRef.current) textareaRef.current.value = "";

    const fd = new FormData();
    fd.append("kid_id", kidId);
    fd.append("message_text", text);

    startTransition(async () => {
      const result = await replyToThread(fd);
      if (result?.error) {
        setSendError(result.error);
        // Restore the unsent text so the coach doesn't lose it.
        if (textareaRef.current) textareaRef.current.value = text;
      }
    });
  }

  return (
    <div className="mt-1.5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          name="message_text"
          rows={2}
          required
          autoFocus
          placeholder="Type your reply…"
          className="w-full resize-none rounded-lg border border-border-gold bg-darkest px-3 py-2 text-sm text-cream-light placeholder:text-text-light/50 focus:border-gold focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-gold/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold/20 disabled:opacity-50"
          >
            <Send size={10} />
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
        {sendError && (
          <p className="text-xs text-red-400">{sendError}</p>
        )}
      </form>
    </div>
  );
}
