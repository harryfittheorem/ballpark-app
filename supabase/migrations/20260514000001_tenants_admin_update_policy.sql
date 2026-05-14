-- =============================================================================
-- Ballpark — task #185: Allow admins to update their own tenant row
-- =============================================================================
-- The /admin/settings portal page needs to write tenants.hittrax_facility_id
-- (and future per-tenant fields) via the authenticated Supabase client.
-- Previously tenants only had a SELECT policy for authenticated users.
--
-- Policy is double-scoped:
--   1. tenant_id = the caller's JWT tenant_id claim  (no cross-tenant writes)
--   2. app_role IN ('admin', 'owner')                (no coach/parent writes)
--
-- GRANT UPDATE is column-specific: only the fields an operator may legitimately
-- change from the portal UI. id, slug, created_at, and the core brand fields
-- are intentionally excluded from this grant — schema changes and branding
-- updates remain a migration/Supabase dashboard operation for now.
-- =============================================================================

-- Row-level UPDATE policy: same-tenant AND admin/owner role.
CREATE POLICY tenants_update_admin ON public.tenants
  FOR UPDATE TO authenticated
  USING (
    id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  )
  WITH CHECK (
    id = (auth.jwt() ->> 'tenant_id')::uuid
    AND (auth.jwt() ->> 'app_role') IN ('admin', 'owner')
  );

-- Column-level grant: only allow updating the fields exposed in the portal
-- settings UI. Keeps the broad UPDATE GRANT from turning into accidental
-- schema / tenant-isolation damage if new columns are added later.
GRANT UPDATE (hittrax_facility_id) ON public.tenants TO authenticated;
