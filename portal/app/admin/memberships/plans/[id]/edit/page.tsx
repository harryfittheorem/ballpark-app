/**
 * /admin/memberships/plans/[id]/edit — Edit an existing membership plan.
 *
 * Lets staff update the name, plan type, price, description, and sort order
 * of any plan in their tenant. Active/inactive toggle stays on the list page.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { updateMembershipPlan } from "../../actions";

type PlanRow = {
  id: string;
  name: string;
  plan_type: "eft" | "otc";
  amount_cents: number;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export default async function EditMembershipPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
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
    .select("id, name, plan_type, amount_cents, description, sort_order, is_active")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }
  const row = data as PlanRow;
  const amountDollars = (row.amount_cents / 100).toFixed(2);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Edit Plan
        </h1>
        <p className="mt-1 text-sm text-text-light">
          Update the name, type, price, description, or display order.
          Active/inactive status is toggled from the{" "}
          <Link
            href="/admin/memberships/plans"
            className="text-gold hover:underline"
          >
            plans list
          </Link>
          .
        </p>
      </div>

      {sp.error && (
        <Card padding="md" className="border-danger/40 bg-danger/5">
          <p className="text-sm text-danger">{sp.error}</p>
        </Card>
      )}

      <Card accent padding="lg">
        <form action={updateMembershipPlan} className="space-y-4">
          <input type="hidden" name="id" value={row.id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="name"
              name="name"
              label="Plan Name"
              required
              maxLength={100}
              defaultValue={row.name}
            />
            <Select
              id="plan_type"
              name="plan_type"
              label="Plan Type"
              required
              defaultValue={row.plan_type}
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
              defaultValue={amountDollars}
              helper="Enter the dollar amount — e.g. 149.00 for $149/month."
            />
            <Input
              id="sort_order"
              name="sort_order"
              label="Sort Order"
              type="number"
              min={0}
              required
              defaultValue={row.sort_order}
              helper="Lower numbers appear first."
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
              defaultValue={row.description ?? ""}
              placeholder="Two private lessons per month plus unlimited cage access."
              className="block w-full rounded-xl border border-border-gold bg-darkest/80 px-3.5 py-2.5 text-sm text-cream-light placeholder:text-text-light/60 shadow-inner transition-colors focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                  (row.is_active
                    ? "bg-success/15 text-success"
                    : "bg-darkest text-text-light")
                }
              >
                {row.is_active ? "Active" : "Inactive"}
              </span>
              <span className="text-xs text-text-light">
                Toggle visibility from the plans list.
              </span>
            </div>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      <Link
        href="/admin/memberships/plans"
        className="inline-block text-sm text-text-light hover:text-gold"
      >
        ← Back to plans
      </Link>
    </div>
  );
}
