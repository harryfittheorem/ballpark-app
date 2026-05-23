"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { readAppRole, readTenantId } from "@/lib/auth";

const STRIPE_VERSION = "2024-06-20";

/**
 * Encodes a potentially-nested object for Stripe's form-encoded API.
 * Nested objects use bracket notation: metadata[key]=value.
 * encodeURIComponent encodes brackets as %5B/%5D, which Stripe correctly decodes.
 */
function encodeForm(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v) && v !== null) {
      const nested = encodeForm(v as Record<string, unknown>, key);
      if (nested) parts.push(nested);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join("&");
}

async function stripePost(
  path: string,
  secretKey: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: encodeForm(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message ?? `Stripe error on POST ${path}`);
  }
  return data;
}

async function requireAdmin() {
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
  return { supabase, tenantId };
}

export async function createPromoCode(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  const code = (formData.get("code") as string | null)?.trim().toUpperCase() ?? "";
  const discountType = formData.get("discount_type") as string | null;
  const discountValueRaw = formData.get("discount_value") as string | null;
  const maxRedemptionsRaw = (formData.get("max_redemptions") as string | null)?.trim();
  const expiresAtRaw = (formData.get("expires_at") as string | null)?.trim();
  const applicablePlanNamesRaw = (
    formData.get("applicable_plan_names") as string | null
  )?.trim() ?? "";

  if (!code) redirect("/admin/promo-codes?error=Code+is+required");
  if (!/^[A-Z0-9_-]{2,50}$/.test(code)) {
    redirect(
      "/admin/promo-codes?error=Code+must+be+2%E2%80%9350+alphanumeric+characters+%28hyphens+and+underscores+allowed%29",
    );
  }
  if (discountType !== "percent" && discountType !== "fixed") {
    redirect("/admin/promo-codes?error=Invalid+discount+type");
  }
  const discountValue = parseInt(discountValueRaw ?? "", 10);
  if (isNaN(discountValue) || discountValue <= 0) {
    redirect("/admin/promo-codes?error=Discount+value+must+be+a+positive+number");
  }
  if (discountType === "percent" && discountValue > 100) {
    redirect("/admin/promo-codes?error=Percent+discount+cannot+exceed+100");
  }

  const maxRedemptions =
    maxRedemptionsRaw ? parseInt(maxRedemptionsRaw, 10) : null;
  if (
    maxRedemptions !== null &&
    (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)
  ) {
    redirect("/admin/promo-codes?error=Max+redemptions+must+be+a+positive+number");
  }

  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  if (expiresAt && isNaN(expiresAt.getTime())) {
    redirect("/admin/promo-codes?error=Invalid+expiry+date");
  }

  let stripeCouponId: string | null = null;
  let stripePromoCodeId: string | null = null;

  if (stripeKey) {
    // Create Stripe Coupon
    const couponParams: Record<string, unknown> = {
      name: code,
      ...(discountType === "percent"
        ? { percent_off: discountValue }
        : { amount_off: discountValue, currency: "usd" }),
      duration: "once",
      metadata: { tenant_id: tenantId, ballpark_code: code },
    };
    if (maxRedemptions !== null) couponParams.max_redemptions = maxRedemptions;
    if (expiresAt) couponParams.redeem_by = Math.floor(expiresAt.getTime() / 1000);

    let coupon: Record<string, unknown>;
    try {
      coupon = await stripePost("coupons", stripeKey, couponParams);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown Stripe error";
      redirect(`/admin/promo-codes?error=${encodeURIComponent("Stripe coupon error: " + msg)}`);
    }
    stripeCouponId = coupon.id as string;

    // Create Stripe PromotionCode
    const promoParams: Record<string, unknown> = {
      coupon: stripeCouponId,
      code,
      metadata: { tenant_id: tenantId },
    };
    if (maxRedemptions !== null) promoParams.max_redemptions = maxRedemptions;
    if (expiresAt) promoParams.expires_at = Math.floor(expiresAt.getTime() / 1000);

    let promoCode: Record<string, unknown>;
    try {
      promoCode = await stripePost("promotion_codes", stripeKey, promoParams);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown Stripe error";
      redirect(
        `/admin/promo-codes?error=${encodeURIComponent("Stripe promo code error: " + msg)}`,
      );
    }
    stripePromoCodeId = promoCode.id as string;
  }

  // Parse applicable plan names (one name per line/comma, blank = unrestricted)
  const applicablePlanNames: string[] = applicablePlanNamesRaw
    ? applicablePlanNamesRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : [];

  // Insert DB row
  const { error: insertErr } = await supabase.from("promo_codes").insert({
    tenant_id: tenantId,
    code,
    stripe_coupon_id: stripeCouponId,
    stripe_promotion_code_id: stripePromoCodeId,
    discount_type: discountType,
    discount_value: discountValue,
    max_redemptions: maxRedemptions,
    expires_at: expiresAt?.toISOString() ?? null,
    applicable_plan_names: applicablePlanNames,
    is_active: true,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      redirect(
        `/admin/promo-codes?error=${encodeURIComponent(`A code "${code}" already exists`)}`,
      );
    }
    redirect(
      `/admin/promo-codes?error=${encodeURIComponent("DB error: " + insertErr.message)}`,
    );
  }

  revalidatePath("/admin/promo-codes");
  redirect("/admin/promo-codes?ok=created");
}

export async function togglePromoCode(formData: FormData) {
  const { supabase, tenantId } = await requireAdmin();

  const id = formData.get("id") as string | null;
  const isActiveStr = formData.get("is_active") as string | null;
  if (!id || isActiveStr === null) {
    redirect("/admin/promo-codes?error=Missing+parameters");
  }

  const isActive = isActiveStr === "true";

  // Load stripe_promotion_code_id before update
  const { data: existing } = await supabase
    .from("promo_codes")
    .select("stripe_promotion_code_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  const { error: updateErr } = await supabase
    .from("promo_codes")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (updateErr) {
    redirect(
      `/admin/promo-codes?error=${encodeURIComponent("DB error: " + updateErr.message)}`,
    );
  }

  // Sync to Stripe (best-effort)
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && existing?.stripe_promotion_code_id) {
    try {
      await stripePost(
        `promotion_codes/${existing.stripe_promotion_code_id}`,
        stripeKey,
        { active: isActive ? "true" : "false" },
      );
    } catch {
      // best-effort; don't fail the request
    }
  }

  revalidatePath("/admin/promo-codes");
  redirect("/admin/promo-codes?ok=updated");
}
