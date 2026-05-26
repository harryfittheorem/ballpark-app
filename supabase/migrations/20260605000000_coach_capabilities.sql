-- =============================================================================
-- Ballpark — Coach capabilities / access-tier presets (Task #310)
-- =============================================================================
-- Adds a `capabilities` JSONB column to `public.coaches` that stores the
-- access-tier preset for each coach. Two presets are defined:
--
--   "instructor" (default) — training tools only (Inbox, Sessions, Assignments)
--   "staff"                — also gets operational portal sections
--                            (Schedule, Check-In, Families, Redemptions)
--
-- The column is forward-compatible with per-capability grants by allowing
-- arbitrary extra keys alongside `preset`. Only the `preset` value is
-- constrained by a CHECK.
--
-- Additionally adds:
--   • An owner/admin UPDATE policy on coaches so the owner can flip presets
--     from the portal team management page.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Add the capabilities column
-- -----------------------------------------------------------------------------
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{"preset":"instructor"}';


-- -----------------------------------------------------------------------------
-- 2. Backfill: any existing row that somehow lacks the column default gets it.
--    ON CONFLICT is not applicable here; the DEFAULT handles new rows.
-- -----------------------------------------------------------------------------
UPDATE public.coaches
  SET capabilities = '{"preset":"instructor"}'::jsonb
  WHERE capabilities IS NULL OR capabilities->>'preset' IS NULL;


-- -----------------------------------------------------------------------------
-- 3. CHECK constraint — preset must be one of the two known tiers
-- -----------------------------------------------------------------------------
ALTER TABLE public.coaches
  ADD CONSTRAINT coaches_capabilities_preset_check
  CHECK ((capabilities->>'preset') IN ('instructor', 'staff'));


-- -----------------------------------------------------------------------------
-- 4. Allow owners and admins to UPDATE any coach row in their tenant.
--    Previously only coaches could update their own row; owners had no UPDATE
--    policy which meant flipping presets from the portal was blocked by RLS.
-- -----------------------------------------------------------------------------
CREATE POLICY coaches_owner_admin_update ON public.coaches
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  WITH CHECK (
    (auth.jwt() ->> 'app_role') IN ('owner', 'admin')
    AND tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );


-- =============================================================================
-- ROLLBACK SQL
-- =============================================================================
-- To undo (in reverse order):
--
--   DROP POLICY IF EXISTS coaches_owner_admin_update ON public.coaches;
--   ALTER TABLE public.coaches DROP CONSTRAINT IF EXISTS coaches_capabilities_preset_check;
--   ALTER TABLE public.coaches DROP COLUMN IF EXISTS capabilities;
-- =============================================================================
