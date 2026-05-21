"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { replyToThread } from "./actions";

interface SentReply {
  id: number;
  text: string;
}

export function InboxReplyForm({ kidId }: { kidId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sentReplies, setSentReplies] = useState<SentReply[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = textareaRef.current?.value?.trim();
    if (!text) return;

    const optimisticId = nextId.current++;
    setSentReplies((prev) => [...prev, { id: optimisticId, text }]);
    if (textareaRef.current) textareaRef.current.value = "";
    setOpen(false);

    const fd = new FormData();
    fd.append("kid_id", kidId);
    fd.append("message_text", text);
    startTransition(async () => {
      await replyToThread(fd);
    });
  }

  return (
    <div className="mt-1.5">
      {sentReplies.length > 0 && (
        <div className="mb-1.5 flex flex-col gap-1">
          {sentReplies.map((reply) => (
            <div
              key={reply.id}
              className="inline-flex max-w-xs items-start gap-1.5 self-end rounded-lg bg-gold/10 border border-gold/30 px-3 py-1.5"
            >
              <span className="text-[12px] text-cream-light leading-snug">
                {reply.text}
              </span>
              {pending && (
                <span className="mt-0.5 text-[10px] text-text-light/60 whitespace-nowrap">
                  sending…
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-full border border-border-gold bg-darkest px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:border-gold hover:bg-gold/10"
        >
          <Send size={9} />
          Reply
        </button>
      ) : (
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-gold bg-gold/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gold transition-colors hover:bg-gold/20"
            >
              <Send size={10} />
              Send
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[11px] text-text-light hover:text-cream-light transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
