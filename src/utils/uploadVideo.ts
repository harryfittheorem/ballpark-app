/**
 * Stream a local video file to a Mux Direct Upload URL.
 *
 * Uses `expo-file-system`'s legacy `createUploadTask` with
 * `BINARY_CONTENT` upload type, which is the canonical Expo way to PUT a
 * `file://` URI as the raw request body. The native module streams the
 * file bytes directly — no JS-side base64/Blob round-trip — and exposes a
 * real progress callback (RN's `fetch` doesn't, and the XHR-with-fake-Blob
 * pattern only works for FormData parts, not for raw PUT bodies).
 *
 * Single attempt; resumable / chunked uploads are out of scope for v0.4
 * (see Step 4.6 task notes).
 */

import {
  createUploadTask,
  FileSystemSessionType,
  FileSystemUploadType,
  type FileSystemUploadResult,
  type UploadTask,
} from 'expo-file-system/legacy';

export type UploadProgressHandler = (fraction: number) => void;

export type UploadHandle = {
  /** Cancel the in-flight PUT. The promise rejects with `UploadCancelledError`. */
  cancel: () => void;
};

export class UploadCancelledError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadCancelledError';
  }
}

export class UploadFailedError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'UploadFailedError';
    this.status = status;
  }
}

export type UploadOptions = {
  uploadUrl: string;
  fileUri: string;
  /** MIME type from the picker if known; falls back to a generic binary type. */
  contentType?: string;
  onProgress?: UploadProgressHandler;
};

/**
 * Returns the upload promise plus a cancel handle. Resolve = HTTP 2xx;
 * reject = `UploadCancelledError` | `UploadFailedError`.
 */
export function uploadVideoToMux(opts: UploadOptions): {
  promise: Promise<void>;
  handle: UploadHandle;
} {
  let cancelled = false;
  let task: UploadTask | null = null;

  const handle: UploadHandle = {
    cancel: () => {
      cancelled = true;
      // cancelAsync is fire-and-forget from the caller's perspective —
      // the awaited uploadAsync() will resolve with `undefined` on cancel,
      // which the promise body below maps to UploadCancelledError.
      void task?.cancelAsync().catch(() => {
        /* already finished or never started */
      });
    },
  };

  const promise = new Promise<void>((resolve, reject) => {
    task = createUploadTask(
      opts.uploadUrl,
      opts.fileUri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystemUploadType.BINARY_CONTENT,
        // FOREGROUND so cancelAsync() actually stops bytes mid-flight on
        // iOS; BACKGROUND uploads continue past the JS lifecycle which we
        // explicitly don't want for v0.4 (see task notes).
        sessionType: FileSystemSessionType.FOREGROUND,
        headers: {
          'Content-Type':
            opts.contentType?.trim() ? opts.contentType : 'application/octet-stream',
        },
      },
      (data) => {
        const { totalBytesSent, totalBytesExpectedToSend } = data;
        if (totalBytesExpectedToSend > 0) {
          const fraction = Math.min(
            1,
            Math.max(0, totalBytesSent / totalBytesExpectedToSend),
          );
          opts.onProgress?.(fraction);
        }
      },
    );

    task
      .uploadAsync()
      .then((result: FileSystemUploadResult | undefined | null) => {
        if (cancelled || !result) {
          reject(new UploadCancelledError());
          return;
        }
        if (result.status >= 200 && result.status < 300) {
          opts.onProgress?.(1);
          resolve();
          return;
        }
        reject(
          new UploadFailedError(
            result.status,
            `Upload failed with status ${result.status}`,
          ),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) {
          reject(new UploadCancelledError());
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Network error during upload';
        reject(new UploadFailedError(0, message));
      });
  });

  return { promise, handle };
}
