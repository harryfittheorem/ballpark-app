"use client";

import { useState } from "react";

export function CopyBookingLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard in non-HTTPS
      const el = document.createElement("textarea");
      el.value = url;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-border-gold bg-darkest px-3 py-2">
        <span className="flex-1 truncate font-mono text-xs text-text-light">
          {url}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md bg-gold px-4 py-1.5 text-xs font-semibold text-dark transition-colors hover:bg-gold-deep focus:outline-none"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Share this URL on your website, social media, or Google Business profile
        so prospective members can browse sessions and book without logging in.
      </p>
    </div>
  );
}
