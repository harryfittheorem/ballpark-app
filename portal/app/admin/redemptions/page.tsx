/**
 * /admin/redemptions — front-desk fulfillment surface (v0.7 task #122).
 *
 * Lists every pending (status='ordered', payment_method='points') order
 * for the admin's tenant + a manual-code-entry form. Submitting either
 * the form or the per-row "Mark fulfilled" button calls the
 * `mark_redemption_fulfilled(p_code)` RPC.
 *
 * Two scan paths: a `<QRScanner />` client component that uses
 * `html5-qrcode` + `getUserMedia` to read the parent's QR straight off
 * the customer's phone screen and auto-submits the manual form; and the
 * manual 8-char input for browsers without camera permission.
 */

import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { QRScanner } from "./QRScanner";
import { fulfillByCode, fulfillById } from "./actions";

type PendingRow = {
  id: string;
  redemption_code: string;
  created_at: string;
  amount_paid_points: number | null;
  payment_method: string;
  status: string;
  kid_id: string;
  product: { name: string | null } | null;
  kid: { first_name: string | null; last_name: string | null } | null;
};

type RecentRow = {
  id: string;
  redemption_code: string;
  fulfilled_at: string | null;
  amount_paid_points: number | null;
  product: { name: string | null } | null;
  kid: { first_name: string | null; last_name: string | null } | null;
};

export default async function RedemptionsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login?reason=unauthenticated");
  if (readAppRole(session) !== "admin") redirect("/logout?reason=forbidden");
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const { data: pending } = await supabase
    .from("orders")
    .select(
      "id, redemption_code, created_at, amount_paid_points, payment_method, " +
        "status, kid_id, product:product_id(name), kid:kid_id(first_name, last_name)",
    )
    .eq("tenant_id", tenantId)
    .eq("payment_method", "points")
    .eq("status", "ordered")
    .order("created_at", { ascending: true });

  const { data: recent } = await supabase
    .from("orders")
    .select(
      "id, redemption_code, fulfilled_at, amount_paid_points, " +
        "product:product_id(name), kid:kid_id(first_name, last_name)",
    )
    .eq("tenant_id", tenantId)
    .eq("status", "fulfilled")
    .order("fulfilled_at", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Redemptions
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Type the 8-character code shown on the parent&apos;s phone, or click
          &quot;Mark fulfilled&quot; on the matching pending row.
        </p>
      </div>

      {sp.ok ? (
        <Card padding="md" className="border-success/40 bg-success/5">
          <p className="text-sm text-success">
            Marked code <span className="font-mono">{sp.ok}</span> as fulfilled.
          </p>
        </Card>
      ) : null}
      {sp.error ? (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">{decodeURIComponent(sp.error)}</p>
        </Card>
      ) : null}

      <Card accent padding="lg">
        <h2 className="font-display text-xl uppercase tracking-wide text-gold">
          Scan or enter code
        </h2>
        <div className="mt-4 space-y-4">
          <QRScanner formId="redemption-fulfill-form" />
          <form
            id="redemption-fulfill-form"
            action={fulfillByCode}
            className="flex flex-wrap gap-3"
          >
            <input
              name="code"
              required
              autoFocus
              placeholder="ABCD1234"
              maxLength={8}
              className="flex-1 min-w-[200px] rounded-md border border-border-gold bg-darkest px-4 py-3 font-mono text-lg uppercase tracking-[0.4em] text-gold outline-none focus:border-gold"
              autoComplete="off"
            />
            <button
              type="submit"
              className="rounded-md bg-gold px-6 py-3 font-display text-lg uppercase tracking-wide text-dark transition hover:opacity-90"
            >
              Fulfill
            </button>
          </form>
        </div>
      </Card>

      <section>
        <h2 className="font-display text-xl uppercase tracking-wide text-cream-light">
          Pending ({pending?.length ?? 0})
        </h2>
        <div className="mt-3 space-y-2">
          {(pending ?? []).length === 0 ? (
            <Card padding="md" className="border-dashed">
              <p className="text-sm text-text-light">
                Nothing pending — every redemption has been handed off.
              </p>
            </Card>
          ) : (
            ((pending ?? []) as unknown as PendingRow[]).map((row) => {
              const product = row.product;
              const kid = row.kid;
              return (
                <Card key={row.id} padding="md">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-display text-lg text-cream-light">
                        {product?.name ?? "—"}
                      </p>
                      <p className="text-sm text-text-light">
                        {kid?.first_name ?? ""} {kid?.last_name ?? ""} ·{" "}
                        {row.amount_paid_points} pts ·{" "}
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-md border border-border-gold bg-darkest px-3 py-1.5 font-mono text-base uppercase tracking-[0.3em] text-gold">
                      {row.redemption_code}
                    </span>
                    <form action={fulfillById}>
                      <input type="hidden" name="code" value={row.redemption_code} />
                      <button
                        type="submit"
                        className="rounded-md border border-border-gold bg-darker px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-gold hover:text-dark"
                      >
                        Mark fulfilled
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl uppercase tracking-wide text-cream-light">
          Recently fulfilled
        </h2>
        <div className="mt-3 space-y-2">
          {(recent ?? []).length === 0 ? (
            <p className="text-sm text-text-light">No fulfilled orders yet.</p>
          ) : (
            ((recent ?? []) as unknown as RecentRow[]).map((row) => {
              const product = row.product;
              const kid = row.kid;
              return (
                <Card key={row.id} padding="sm">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-display text-base text-cream-light">
                      {product?.name ?? "—"}
                    </span>
                    <span className="text-text-light">
                      {kid?.first_name ?? ""} {kid?.last_name ?? ""}
                    </span>
                    <span className="text-text-light">{row.amount_paid_points} pts</span>
                    <span className="ml-auto font-mono text-xs uppercase tracking-[0.3em] text-text-light">
                      {row.redemption_code}
                    </span>
                    <span className="text-xs text-text-light">
                      {row.fulfilled_at
                        ? new Date(row.fulfilled_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
