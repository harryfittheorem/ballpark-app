/**
 * Local UI state machine for the Record Video screen.
 *
 *   idle       — two big buttons: Record / Choose from Library.
 *   uploading  — show progress bar + cancel; can transition to errored or done.
 *   errored    — show message + Retry / Pick another.
 *
 * `pickedAsset` survives across uploading/errored so Retry can re-PUT the
 * same file with the SAME idempotency key (preventing duplicate `videos`
 * rows on flaky networks). A fresh pick clears it and mints a new key.
 */

export type PickedAsset = {
  uri: string;
  mimeType?: string;
  /** Optional duration from the picker, in seconds — used purely for telemetry/UI. */
  durationSec?: number;
};

export type RecordVideoState =
  | { kind: 'idle' }
  | { kind: 'uploading'; asset: PickedAsset; progress: number; idempotencyKey: string }
  | {
      kind: 'errored';
      asset: PickedAsset;
      idempotencyKey: string;
      message: string;
    };
