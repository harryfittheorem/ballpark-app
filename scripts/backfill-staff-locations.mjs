#!/usr/bin/env node
/**
 * scripts/backfill-staff-locations.mjs
 *
 * Idempotent backfill of public.staff_locations.
 *
 * For each admin/owner user in auth.users (identified by raw_user_meta_data
 * app_role = 'admin' or 'owner'), creates one staff_locations row per active
 * location in their tenant.
 *
 * Designed to be run once before applying:
 *   20260601000003_phase2_admin_rls_staff_locations.sql
 *
 * Applying that RLS migration without this backfill will lock all admins out
 * of their own data because their staff_locations rows won't exist yet.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   EXPO_PUBLIC_SUPABASE_URL=<url> \
 *   node scripts/backfill-staff-locations.mjs
 *
 * Exit codes:
 *   0 — backfill complete (or nothing to do)
 *   1 — fatal error
 *
 * Idempotency: uses ON CONFLICT (user_id, location_id) DO NOTHING via the
 * Supabase upsert path (ignoreDuplicates: true). Safe to re-run.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log("=== Phase 2 staff_locations backfill ===\n");

  // 1. List all admin/owner users from auth.users via the Admin API.
  console.log("Listing all auth users with app_role admin or owner...");
  const { data: usersPage, error: listErr } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    console.error("ERROR listing users:", listErr.message);
    process.exit(1);
  }

  const staffUsers = usersPage.users.filter((u) => {
    const role = u.raw_user_meta_data?.app_role;
    return role === "admin" || role === "owner";
  });

  if (staffUsers.length === 0) {
    console.log("No admin/owner users found. Nothing to backfill.");
    return;
  }
  console.log(`Found ${staffUsers.length} admin/owner user(s).\n`);

  // 2. For each staff user, resolve their tenant and assign all active locations.
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const user of staffUsers) {
    const tenantSlug = user.raw_user_meta_data?.tenant_slug;
    const appRole = user.raw_user_meta_data?.app_role;

    if (!tenantSlug) {
      console.warn(
        `  WARN: user ${user.email} (${user.id}) has no tenant_slug — skipping.`,
      );
      continue;
    }

    // Resolve tenant id.
    const { data: tenant, error: tenantErr } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", tenantSlug)
      .maybeSingle();

    if (tenantErr || !tenant) {
      console.warn(
        `  WARN: tenant '${tenantSlug}' not found for ${user.email} — skipping.`,
      );
      continue;
    }

    // List all active locations for this tenant.
    const { data: locations, error: locErr } = await supabase
      .from("locations")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true);

    if (locErr) {
      console.error(
        `  ERROR fetching locations for tenant ${tenantSlug}:`,
        locErr.message,
      );
      process.exit(1);
    }

    if (!locations || locations.length === 0) {
      console.warn(
        `  WARN: no active locations found for tenant '${tenantSlug}' — skipping user ${user.email}.`,
      );
      continue;
    }

    const rows = locations.map((loc) => ({
      user_id: user.id,
      tenant_id: tenant.id,
      location_id: loc.id,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("staff_locations")
      .upsert(rows, { ignoreDuplicates: true, onConflict: "user_id,location_id" })
      .select("id");

    if (insertErr) {
      console.error(
        `  ERROR inserting staff_locations for ${user.email}:`,
        insertErr.message,
      );
      process.exit(1);
    }

    const insertedCount = inserted?.length ?? 0;
    const skippedCount = rows.length - insertedCount;
    totalInserted += insertedCount;
    totalSkipped += skippedCount;

    console.log(
      `  ${appRole} ${user.email}: ${insertedCount} inserted, ${skippedCount} already existed (${locations.length} locations total).`,
    );
  }

  console.log(`\n=== Backfill complete ===`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Skipped (already existed): ${totalSkipped}`);
  console.log(`\nVerification query (run in Supabase SQL editor):`);
  console.log(`  SELECT COUNT(*) FROM public.staff_locations;`);
  console.log(
    `  -- Should equal ${totalInserted + totalSkipped} (or more if other backfills ran first).`,
  );
  console.log(
    `\nOnly apply 20260601000003_phase2_admin_rls_staff_locations.sql once`,
  );
  console.log(`this count is confirmed correct.`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
