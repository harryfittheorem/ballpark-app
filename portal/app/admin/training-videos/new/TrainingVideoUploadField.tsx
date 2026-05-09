"use client";

/**
 * Upload + manual playback-id field for training videos (v0.7 task #121).
 *
 * Two ways to supply mux_playback_id to the create action:
 *   1. Upload a file: POST /api/admin/training-uploads → mints a Mux
 *      Direct Upload + inserts the videos row. We then poll
 *      GET /api/admin/videos/{id} every 3s for up to ~3 minutes
 *      waiting for the asset.ready webhook to populate
 *      videos.mux_playback_id, then auto-fill the playback id field.
 *   2. Paste a known Mux playback id directly (handy for swapping
 *      seed assets without re-uploading).
 *
 * The form's createTrainingVideo action accepts either route.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_BYTES = 500 * 1024 * 1024;

type UploadStatus =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "uploading"; progress: number }
  | { kind: "processing"; videoId: string; fileName: string }
  | { kind: "done"; videoId: string; playbackId: string; fileName: string }
  | { kind: "error"; message: string; canRetry: boolean };

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function TrainingVideoUploadField({
  onBusyChange,
  defaultPlaybackId = "",
}: {
  onBusyChange?: (busy: boolean) => void;
  defaultPlaybackId?: string;
}) {
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const [playbackId, setPlaybackId] = useState<string>(defaultPlaybackId);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBusy =
    status.kind === "minting" ||
    status.kind === "uploading" ||
    status.kind === "processing";

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      xhrRef.current?.abort();
    };
  }, []);

  const pollForReady = useCallback(
    (videoId: string, fileName: string, attempt = 0) => {
      const MAX_ATTEMPTS = 60; // 60 * 3s = 3 minutes
      pollTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/admin/videos/${videoId}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const body = (await res.json()) as {
              mux_playback_id: string | null;
              status: string;
            };
            if (body.mux_playback_id) {
              setStatus({
                kind: "done",
                videoId,
                playbackId: body.mux_playback_id,
                fileName,
              });
              setPlaybackId(body.mux_playback_id);
              return;
            }
          }
        } catch {
          // ignore network blip; we'll retry below
        }
        if (attempt + 1 >= MAX_ATTEMPTS) {
          setStatus({
            kind: "error",
            canRetry: true,
            message:
              "Mux didn't finish processing within 3 minutes. You can paste the playback id manually once it's ready, or save as a draft and revisit.",
          });
          return;
        }
        pollForReady(videoId, fileName, attempt + 1);
      }, 3000);
    },
    [],
  );

  const startUpload = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        setStatus({
          kind: "error",
          canRetry: false,
          message: `That file is ${fmtBytes(file.size)} — please pick something under ${fmtBytes(MAX_BYTES)}.`,
        });
        return;
      }

      setStatus({ kind: "minting" });

      let mintRes: Response;
      try {
        mintRes = await fetch("/api/admin/training-uploads", { method: "POST" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setStatus({
          kind: "error",
          canRetry: true,
          message: `Could not reach the server (${msg}).`,
        });
        return;
      }

      let mintBody: {
        upload_url?: string;
        video_id?: string;
        error?: { message?: string };
      };
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
      const fileName = file.name;

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
          setStatus({ kind: "processing", videoId, fileName });
          pollForReady(videoId, fileName);
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      };

      xhr.send(file);
    },
    [pollForReady],
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void startUpload(file);
  };

  const cancel = () => xhrRef.current?.abort();

  // Hidden inputs the server action reads.
  const videoId =
    status.kind === "processing" || status.kind === "done"
      ? status.videoId
      : "";

  return (
    <div className="space-y-3">
      <input type="hidden" name="video_id" value={videoId} />

      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep">
        Upload video
      </label>
      {status.kind === "idle" || status.kind === "error" ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={onFile}
          className="block w-full cursor-pointer rounded-xl border border-border-gold bg-darkest text-sm text-cream file:mr-4 file:cursor-pointer file:border-0 file:bg-gold file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-darkest hover:file:bg-gold-hover"
        />
      ) : null}

      {status.kind === "minting" ? (
        <div className="rounded-xl border border-border-gold bg-darkest/60 px-4 py-3 text-sm text-text-light">
          Preparing upload…
        </div>
      ) : null}

      {status.kind === "uploading" ? (
        <div className="space-y-2 rounded-xl border border-border-gold bg-darkest/60 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-cream-light">Uploading…</span>
            <span className="text-text-light">{status.progress}%</span>
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

      {status.kind === "processing" ? (
        <div className="rounded-xl border border-border-gold bg-darkest/60 px-4 py-3 text-sm text-text-light">
          Mux is processing the asset… This usually takes under a minute.
          The playback id will fill in below automatically when it&rsquo;s ready.
        </div>
      ) : null}

      {status.kind === "done" ? (
        <div className="rounded-xl border border-success/40 bg-success-bg px-4 py-3 text-sm text-success">
          <p className="font-semibold">Asset ready</p>
          <p className="mt-0.5 text-xs">
            {status.fileName} · playback id captured below.
          </p>
        </div>
      ) : null}

      {status.kind === "error" ? (
        <div className="rounded-xl border border-danger/40 bg-danger-bg px-4 py-3 text-sm text-danger">
          {status.message}
        </div>
      ) : null}

      <div className="space-y-1.5 pt-1">
        <label
          htmlFor="mux_playback_id"
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
        >
          Mux playback id
        </label>
        <input
          id="mux_playback_id"
          name="mux_playback_id"
          type="text"
          value={playbackId}
          onChange={(e) => setPlaybackId(e.target.value)}
          placeholder="DS00Spx1CV902MCtPj5WknGlR102V5HFkDe"
          className="block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 font-mono text-xs text-cream-light shadow-inner focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
        />
        <p className="text-xs text-text-light">
          Auto-filled once Mux finishes processing your upload, or paste an
          existing playback id to reuse a known asset.
        </p>
      </div>
    </div>
  );
}
