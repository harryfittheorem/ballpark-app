"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
}: {
  recent: RecentVideo[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const hasRecent = recent.length > 0;
  const [mode, setMode] = useState<Mode>(hasRecent ? "pick" : "upload");
  const [pickedId, setPickedId] = useState<string>("");
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const [pickedFileName, setPickedFileName] = useState<string>("");
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // The hidden form input the Server Action reads. Only one of the two modes
  // contributes a value at any time; the other contributes "".
  const submittedVideoId =
    mode === "upload"
      ? status.kind === "done"
        ? status.videoId
        : ""
      : pickedId;

  // The form should disable Create while an upload is in flight.
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

    // PUT the file bytes directly to Mux. We use XHR because fetch() does not
    // expose upload progress events in the browser.
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
        <label className="block text-sm font-medium text-slate-900">
          Drill video{" "}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        {hasRecent ? (
          <div
            role="tablist"
            className="inline-flex overflow-hidden rounded-md border border-slate-300 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "upload"}
              onClick={() => setMode("upload")}
              disabled={isBusy}
              className={`px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 ${mode === "upload" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Upload new
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "pick"}
              onClick={() => setMode("pick")}
              disabled={isBusy}
              className={`border-l border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50 ${mode === "pick" ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              Pick from recent
            </button>
          </div>
        ) : null}
      </div>

      {/* Hidden field the Server Action reads. Always present so the form has
          a stable contract — value is "" when no video is selected. */}
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
                className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="text-xs text-slate-500">
                MP4 / MOV / WebM up to {fmtBytes(MAX_BYTES)}. Uploads stream
                directly to Mux.
              </p>
            </>
          ) : null}

          {status.kind === "minting" ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Preparing upload…
            </div>
          ) : null}

          {status.kind === "uploading" ? (
            <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between text-xs">
                <span
                  className="truncate pr-3 font-medium text-slate-700"
                  title={pickedFileName}
                >
                  {pickedFileName || "Uploading…"}
                </span>
                <span className="shrink-0 text-slate-500">
                  {status.progress}%
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={status.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full bg-slate-900 transition-[width] duration-150"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={cancel}
                className="text-xs text-slate-600 underline hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {status.kind === "done" ? (
            <div className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-emerald-800">
                  Upload complete
                </p>
                <p
                  className="mt-0.5 truncate text-xs text-emerald-700"
                  title={status.fileName}
                >
                  {status.fileName} • Mux is processing
                </p>
                <p className="mt-1 font-mono text-[10px] text-emerald-700/80">
                  {status.videoId}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-xs text-emerald-800 underline hover:text-emerald-900"
              >
                Replace
              </button>
            </div>
          ) : null}

          {status.kind === "error" ? (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
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
                  className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Pick a file and retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          <select
            value={pickedId}
            onChange={(e) => setPickedId(e.target.value)}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
          <p className="text-xs text-slate-500">
            Pick from your last 20 drill videos uploaded via the mobile app.
          </p>
        </div>
      )}
    </div>
  );
}
