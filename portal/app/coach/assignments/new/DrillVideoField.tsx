"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fieldClasses } from "@/components/ui/Input";

type RecentVideo = {
  id: string;
  title: string | null;
  created_at: string;
};

type Mode = "upload" | "pick";

type UploadStatus =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "uploading"; progress: number }
  | { kind: "done"; videoId: string; fileName: string }
  | { kind: "error"; message: string; canRetry: boolean };

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365)
    return RTF.format(Math.round(diffSec / (86400 * 30)), "month");
  return RTF.format(Math.round(diffSec / (86400 * 365)), "year");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function DrillVideoField({
  recent,
  onBusyChange,
  initialPickedId = "",
}: {
  recent: RecentVideo[];
  onBusyChange?: (busy: boolean) => void;
  /** Pre-select an existing drill video id (used by the edit form). */
  initialPickedId?: string;
}) {
  const hasRecent = recent.length > 0;
  const [mode, setMode] = useState<Mode>(hasRecent ? "pick" : "upload");
  const [pickedId, setPickedId] = useState<string>(initialPickedId);
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const [pickedFileName, setPickedFileName] = useState<string>("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const submittedVideoId =
    mode === "upload"
      ? status.kind === "done"
        ? status.videoId
        : ""
      : pickedId;

  const isBusy = status.kind === "minting" || status.kind === "uploading";

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  const startUpload = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) {
      setStatus({
        kind: "error",
        canRetry: false,
        message: `That file is ${fmtBytes(file.size)} — please pick something under ${fmtBytes(MAX_BYTES)}.`,
      });
      return;
    }

    setPickedFileName(file.name);
    setStatus({ kind: "minting" });

    let mintRes: Response;
    try {
      mintRes = await fetch("/api/coach/drill-uploads", { method: "POST" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setStatus({
        kind: "error",
        canRetry: true,
        message: `Could not reach the server (${msg}).`,
      });
      return;
    }

    let mintBody: { upload_url?: string; video_id?: string; error?: { message?: string } };
    try {
      mintBody = (await mintRes.json()) as typeof mintBody;
    } catch {
      setStatus({
        kind: "error",
        canRetry: true,
        message: "Server returned an unreadable response.",
      });
      return;
    }

    if (!mintRes.ok || !mintBody.upload_url || !mintBody.video_id) {
      setStatus({
        kind: "error",
        canRetry: true,
        message:
          mintBody?.error?.message ??
          `Upload service returned status ${mintRes.status}.`,
      });
      return;
    }

    const uploadUrl = mintBody.upload_url;
    const videoId = mintBody.video_id;

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    setStatus({ kind: "uploading", progress: 0 });

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (ev: ProgressEvent) => {
      if (!ev.lengthComputable) return;
      const pct = Math.round((ev.loaded / ev.total) * 100);
      setStatus({ kind: "uploading", progress: pct });
    };
    xhr.onload = () => {
      xhrRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus({ kind: "done", videoId, fileName: file.name });
      } else {
        setStatus({
          kind: "error",
          canRetry: true,
          message: `Upload failed (status ${xhr.status}).`,
        });
      }
    };
    xhr.onerror = () => {
      xhrRef.current = null;
      setStatus({
        kind: "error",
        canRetry: true,
        message: "Network error during upload.",
      });
    };
    xhr.onabort = () => {
      xhrRef.current = null;
      setStatus({ kind: "idle" });
      setPickedFileName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    xhr.send(file);
  }, []);

  const cancel = () => {
    xhrRef.current?.abort();
  };

  const reset = () => {
    setStatus({ kind: "idle" });
    setPickedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void startUpload(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
          <span>Drill video</span>
          <span className="text-[10px] font-normal normal-case tracking-normal text-text-light">
            optional
          </span>
        </label>
        {hasRecent ? (
          <div
            role="tablist"
            className="inline-flex overflow-hidden rounded-xl border border-border-gold text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              onClick={() => setMode("upload")}
              disabled={isBusy}
              className={`px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === "upload" ? "bg-gold text-darkest" : "bg-darkest text-text-light hover:text-cream-light"}`}
            >
              Upload new
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "pick"}
              onClick={() => setMode("pick")}
              disabled={isBusy}
              className={`border-l border-border-gold px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${mode === "pick" ? "bg-gold text-darkest" : "bg-darkest text-text-light hover:text-cream-light"}`}
            >
              Pick from recent
            </button>
          </div>
        ) : null}
      </div>

      <input type="hidden" name="drill_video_id" value={submittedVideoId} />

      {mode === "upload" ? (
        <div className="space-y-2">
          {status.kind === "idle" || status.kind === "error" ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={onFile}
                className="block w-full cursor-pointer rounded-xl border border-border-gold bg-darkest text-sm text-cream file:mr-4 file:cursor-pointer file:border-0 file:bg-gold file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-darkest hover:file:bg-gold-hover"
              />
              <p className="text-xs text-text-light">
                MP4 / MOV / WebM up to {fmtBytes(MAX_BYTES)}. Uploads stream
                directly to Mux.
              </p>
            </>
          ) : null}

          {status.kind === "minting" ? (
            <div className="rounded-xl border border-border-gold bg-darkest/60 px-4 py-3 text-sm text-text-light">
              Preparing upload…
            </div>
          ) : null}

          {status.kind === "uploading" ? (
            <div className="space-y-2 rounded-xl border border-border-gold bg-darkest/60 px-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <span
                  className="truncate pr-3 font-medium text-cream-light"
                  title={pickedFileName}
                >
                  {pickedFileName || "Uploading…"}
                </span>
                <span className="shrink-0 text-text-light">
                  {status.progress}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-darkest"
                role="progressbar"
                aria-valuenow={status.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-gold transition-[width] duration-150"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={cancel}
                className="text-xs text-text-light underline-offset-2 hover:text-gold hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {status.kind === "done" ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-success/40 bg-success-bg px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-success">Upload complete</p>
                <p
                  className="mt-0.5 truncate text-xs text-success/80"
                  title={status.fileName}
                >
                  {status.fileName} • Mux is processing
                </p>
                <p className="mt-1 font-mono text-[10px] text-success/70">
                  {status.videoId}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-xs text-success underline-offset-2 hover:underline"
              >
                Replace
              </button>
            </div>
          ) : null}

          {status.kind === "error" ? (
            <div className="space-y-2 rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
              <p>{status.message}</p>
              {status.canRetry ? (
                <button
                  type="button"
                  onClick={() => {
                    // Clear value first so re-picking the SAME file still
                    // fires onChange — otherwise browsers suppress it.
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    fileInputRef.current?.click();
                  }}
                  className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-cream-light hover:bg-danger/90"
                >
                  Pick a file and retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          <select
            value={pickedId}
            onChange={(e) => setPickedId(e.target.value)}
            className={fieldClasses()}
          >
            <option value="">No video / link later</option>
            {recent.map((v) => (
              <option key={v.id} value={v.id}>
                {(v.title?.trim() || "Untitled drill") +
                  " • " +
                  relativeTime(v.created_at)}
              </option>
            ))}
          </select>
          <p className="text-xs text-text-light">
            Pick from your last 20 drill videos uploaded via the mobile app.
          </p>
        </div>
      )}
    </div>
  );
}
