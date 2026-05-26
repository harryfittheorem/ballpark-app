/**
 * /admin/memberships/plans — Membership plan tier management.
 *
 * Lists all tenant membership plans (active + inactive). Staff can create a
 * new plan, edit an existing one, and toggle plans active/inactive. Changes
 * are immediately reflected in what parents see on the Upgrade Plan screen.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { createMembershipPlan, toggleMembershipPlan } from "./actions";

type PlanRow = {
  id: string;
  name: string;
  plan_type: "eft" | "otc";
  amount_cents: number;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtPlanType(type: "eft" | "otc"): string {
  return type === "eft" ? "EFT (Recurring)" : "OTC (Pack)";
}

export default async function MembershipPlansPage({
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

  const { data, error } = await (supabase as unknown as import("@supabase/supabase-js").SupabaseClient)
    .from("membership_plans")
    .select("id, name, plan_type, amount_cents, description, sort_order, is_active, created_at")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (data ?? []) as PlanRow[];
  const activePlans = rows.filter((r) => r.is_active);
  const inactivePlans = rows.filter((r) => !r.is_active);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Membership Plans
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Manage the plan tiers shown to parents on the Upgrade Plan screen.
          Active plans are visible to members; inactive plans are hidden.
        </p>
      </div>

      {sp.ok === "created" && (
        <Card padding="md" className="border-success/40 bg-success/5">
          <p className="text-sm text-success">Plan created successfully.</p>
        </Card>
      )}
      {sp.ok === "updated" && (
        <Card padding="md" className="border-success/40 bg-success/5">
          <p className="text-sm text-success">Plan updated.</p>
        </Card>
      )}
      {sp.error && (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      )}
      {error && (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">
            Failed to load plans: {error.message}
          </p>
        </Card>
      )}

      {/* ── Create Plan Form ────────────────────────────────────────────── */}
      <Card accent padding="lg">
        <h2 className="mb-4 font-display text-xl uppercase tracking-wide text-gold">
          Add a Plan
        </h2>
        <form action={createMembershipPlan} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="name"
              name="name"
              label="Plan Name"
              placeholder="Elite — Unlimited"
              required
              maxLength={100}
            />
            <Select
              id="plan_type"
              name="plan_type"
              label="Plan Type"
              required
            >
              <option value="eft">EFT (Recurring monthly)</option>
              <option value="otc">OTC (Session pack)</option>
            </Select>
            <Input
              id="amount_dollars"
              name="amount_dollars"
              label="Price (USD)"
              type="number"
              min={0}
              step={0.01}
              required
              placeholder="149.00"
              helper="Enter the dollar amount — e.g. 149.00 for $149/month."
            />
            <Input
              id="sort_order"
              name="sort_order"
              label="Sort Order"
              type="number"
              min={0}
              defaultValue={10}
              required
              helper="Lower numbers appear first. Use 10, 20, 30… to leave room."
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-deep"
            >
              <span>Description</span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-text-light">
                optional
              </span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Two private lessons per month plus unlimited cage access."
              className="block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 text-sm text-cream-light placeholder:text-text-light/60 shadow-inner transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Create Plan
            </Button>
          </div>
        </form>
      </Card>

      {/* ── Active Plans ────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-cream-light">
          Active Plans{" "}
          <span className="ml-1 text-sm font-normal normal-case text-text-light">
            ({activePlans.length})
          </span>
        </h2>
        {activePlans.length === 0 ? (
          <Card accent padding="lg" className="text-center">
            <p className="text-sm text-cream-light">No active plans yet.</p>
            <p className="mt-2 text-xs text-text-light">
              Use the form above to create your first plan.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {activePlans.map((row) => (
              <PlanCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* ── Inactive Plans ──────────────────────────────────────────────── */}
      {inactivePlans.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg uppercase tracking-wide text-text-light">
            Inactive Plans{" "}
            <span className="ml-1 text-sm font-normal normal-case">
              ({inactivePlans.length})
            </span>
          </h2>
          <div className="space-y-3">
            {inactivePlans.map((row) => (
              <PlanCard key={row.id} row={row} />
            ))}
          </div>
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

function PlanCard({ row }: { row: PlanRow }) {
  return (
    <Card padding="md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-cream-light">
              {row.name}
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
          <p className="text-sm text-gold">
            {fmtPrice(row.amount_cents)}{" "}
            <span className="text-text-light">·</span>{" "}
            {fmtPlanType(row.plan_type)}{" "}
            <span className="text-text-light">· Sort {row.sort_order}</span>
          </p>
          {row.description && (
            <p className="text-xs text-text-light">{row.description}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/memberships/plans/${row.id}/edit`}
            className="rounded-lg border border-border-gold bg-darkest px-3 py-1.5 text-xs text-cream hover:border-gold hover:text-gold transition"
          >
            Edit
          </Link>
          <form action={toggleMembershipPlan}>
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
              {row.is_active ? "Hide" : "Show"}
            </button>
          </form>
        </div>
      </div>
    </Card>
  );
}
