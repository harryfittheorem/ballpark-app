/**
 * /admin/promo-codes — Promo code management (Task #241).
 *
 * Lists all tenant promo codes with redemption counts. Lets staff create
 * new codes (Stripe Coupon + PromotionCode are created automatically) and
 * toggle codes active/inactive. Toggle also updates the Stripe PromotionCode.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createPromoCode, togglePromoCode } from "./actions";

type PromoRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_redemptions: number | null;
  redemptions_used: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
};

function fmtDiscount(row: PromoRow): string {
  if (row.discount_type === "percent") return `${row.discount_value}% off`;
  return `$${(row.discount_value / 100).toFixed(2)} off`;
}

function fmtExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRedemptions(row: PromoRow): string {
  const used = row.redemptions_used;
  if (row.max_redemptions == null) return `${used} used`;
  return `${used} / ${row.max_redemptions} redemptions`;
}

export default async function PromoCodesPage({
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
  if (!["admin", "owner"].includes(readAppRole(session))) {
    redirect("/logout?reason=forbidden");
  }
  const tenantId = readTenantId(session);
  if (!tenantId) redirect("/logout?reason=no-tenant");

  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, max_redemptions, redemptions_used, expires_at, is_active, created_at, stripe_coupon_id, stripe_promotion_code_id",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as PromoRow[];
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Promo Codes
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Create discount codes for membership signups. Each code creates a
          matching Stripe Coupon and PromotionCode.
        </p>
        {!stripeConfigured && (
          <p className="mt-2 text-xs text-danger">
            ⚠ STRIPE_SECRET_KEY is not configured — codes will be saved to the
            database only, without Stripe integration.
          </p>
        )}
      </div>

      {sp.ok === "created" && (
        <Card padding="md" className="border-success/40 bg-success/5">
          <p className="text-sm text-success">Promo code created successfully.</p>
        </Card>
      )}
      {sp.ok === "updated" && (
        <Card padding="md" className="border-success/40 bg-success/5">
          <p className="text-sm text-success">Promo code updated.</p>
        </Card>
      )}
      {sp.error && (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      )}
      {error && (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">Failed to load codes: {error.message}</p>
        </Card>
      )}

      {/* ── Create Code Form ───────────────────────────────────────────── */}
      <Card accent padding="lg">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wide text-gold">
          Create Code
        </h2>
        <form action={createPromoCode} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="code"
              name="code"
              label="Code"
              placeholder="SUMMER25"
              required
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              helper="Letters, numbers, hyphens, underscores only. Will be uppercased."
            />
            <Select
              id="discount_type"
              name="discount_type"
              label="Discount Type"
              required
            >
              <option value="percent">Percent off (%)</option>
              <option value="fixed">Fixed amount off (cents)</option>
            </Select>
            <Input
              id="discount_value"
              name="discount_value"
              label="Discount Value"
              type="number"
              min={1}
              max={10000}
              required
              placeholder="25"
              helper="For percent: 25 = 25%. For fixed: enter cents (2500 = $25)."
            />
            <Input
              id="max_redemptions"
              name="max_redemptions"
              label="Max Redemptions"
              type="number"
              min={1}
              placeholder="Leave blank for unlimited"
              optional
            />
            <Input
              id="expires_at"
              name="expires_at"
              label="Expiry Date"
              type="date"
              optional
            />
          </div>
          <div>
            <label
              htmlFor="applicable_plan_names"
              className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
            >
              <span>Restrict to specific plan names</span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-text-light">
                optional
              </span>
            </label>
            <textarea
              id="applicable_plan_names"
              name="applicable_plan_names"
              rows={2}
              placeholder={
                "Leave blank to allow for any plan.\n" +
                "Or enter plan names (one per line) — e.g. Elite Monthly, Standard EFT."
              }
              className="block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 text-sm text-cream-light placeholder:text-text-light/60 shadow-inner transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
            <p className="mt-1 text-xs text-text-light">
              When set, only memberships with a matching plan name can redeem this code (
              <code className="text-gold-deep">PLAN_MISMATCH</code> otherwise). Must match
              exactly — case-sensitive.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Create Code
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Code Table ─────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <Card accent padding="lg" className="text-center">
          <p className="text-sm text-cream-light">No promo codes yet.</p>
          <p className="mt-2 text-xs text-text-light">
            Use the form above to create your first code.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id} padding="md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-bold text-gold">
                      {row.code}
                    </span>
                    {row.is_active ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-darkest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-light">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-cream-light">
                    {fmtDiscount(row)} · {fmtRedemptions(row)} · Expires{" "}
                    {fmtExpiry(row.expires_at)}
                  </p>
                  {row.stripe_promotion_code_id && (
                    <p className="font-mono text-[10px] text-text-light">
                      Stripe: {row.stripe_promotion_code_id}
                    </p>
                  )}
                </div>

                <form action={togglePromoCode} className="shrink-0">
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="is_active"
                    value={row.is_active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className={
                      "rounded-lg border px-3 py-1.5 text-xs transition " +
                      (row.is_active
                        ? "border-danger/40 bg-danger/15 text-danger hover:bg-danger/25"
                        : "border-border-gold bg-darkest text-cream hover:border-gold hover:text-gold")
                    }
                  >
                    {row.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Link
        href="/admin"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to admin
      </Link>
    </div>
  );
}
