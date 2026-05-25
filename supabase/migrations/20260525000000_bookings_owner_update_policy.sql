-- Allow owners to update any booking in their tenant.
-- Needed for cage assignment, status changes, and cancellations from the portal.
-- Mirrors the existing bookings_owner_select policy (same tenant_id check).

CREATE POLICY bookings_owner_update ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') = 'owner'
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
