"use client";

/**
 * QRScanner — front-desk camera scan for `/admin/redemptions`
 * (v0.7 task #122).
 *
 * Wraps `html5-qrcode` so the staff phone/laptop camera reads the
 * customer's redemption QR (which encodes the same 8-char alphanumeric
 * code as the printed text below it). On a successful scan we
 * uppercase + sanitise the payload to `[A-Z0-9]{8}`, fill the manual
 * form's `code` input, stop the camera, and submit the form — so the
 * scan flow short-circuits straight into `mark_redemption_fulfilled`
 * with no extra clicks. Manual entry remains the fallback for browsers
 * without camera permission or with no camera.
 */

import { useEffect, useRef, useState } from "react";

type Html5QrcodeModule = typeof import("html5-qrcode");

export function QRScanner({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    (async () => {
      try {
        const mod: Html5QrcodeModule = await import("html5-qrcode");
        if (cancelled || !containerRef.current) return;
        const elementId = "qr-scan-region";
        // The library wants a stable id, so attach it imperatively.
        containerRef.current.id = elementId;
        const Html5Qrcode = mod.Html5Qrcode;
        const scanner = new Html5Qrcode(elementId, /* verbose */ false);
        const ref = {
          stop: () => scanner.stop().catch(() => undefined),
          clear: () => {
            try {
              scanner.clear();
            } catch {
              /* no-op */
            }
          },
        };
        scannerRef.current = ref;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decoded: string) => {
            const code = decoded.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
            if (code.length !== 8) return;
            const form = document.getElementById(formId) as HTMLFormElement | null;
            if (!form) return;
            const input = form.querySelector<HTMLInputElement>('input[name="code"]');
            if (!input) return;
            input.value = code;
            ref.stop().finally(() => {
              ref.clear();
              setOpen(false);
              form.requestSubmit();
            });
          },
          () => {
            /* per-frame decode errors are noisy; ignore */
          },
        );

        cleanupFn = () => {
          ref.stop().finally(() => ref.clear());
        };
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not start the camera. Use manual entry below.",
        );
      }
    })();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
      scannerRef.current = null;
    };
  }, [open, formId]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md border border-border-gold bg-darker px-4 py-3 font-display text-base uppercase tracking-wide text-gold transition hover:bg-gold hover:text-dark"
      >
        Scan QR
      </button>
    );
  }

  return (
    <div className="w-full rounded-md border border-border-gold bg-darkest p-4">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm uppercase tracking-wide text-gold">
          Point the camera at the customer&apos;s QR code
        </p>
        <button
          type="button"
          onClick={() => {
            scannerRef.current?.stop().finally(() => {
              scannerRef.current?.clear();
              setOpen(false);
            });
          }}
          className="text-sm uppercase tracking-wide text-text-light hover:text-cream-light"
        >
          Close
        </button>
      </div>
      <div
        ref={containerRef}
        className="mt-3 mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-md bg-dark"
      />
      {error ? (
        <p className="mt-3 text-sm text-danger">{error}</p>
      ) : (
        <p className="mt-3 text-xs text-text-light">
          You can also type the 8-character code manually below.
        </p>
      )}
    </div>
  );
}
