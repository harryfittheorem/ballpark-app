-- ---------------------------------------------------------------------------
-- publish_waiver_version(p_tenant_id, p_body_text, p_effective_date)
--
-- Atomically publishes a new waiver version for the given tenant:
--   1. Deactivates the current active waiver (if any).
--   2. Inserts the new waiver with is_active = true.
--
-- Both steps run inside the same PL/pgSQL transaction, so the unique
-- partial index idx_waivers_one_active_per_tenant can never be violated
-- and the tenant is never left with zero active waivers.
--
-- Returns the new waiver's id, version, and effective_date.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.publish_waiver_version(
  p_tenant_id      uuid,
  p_body_text      text,
  p_effective_date date
)
RETURNS TABLE(new_id uuid, new_version integer, new_effective_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_version integer;
  v_new_id       uuid;
BEGIN
  IF p_body_text IS NULL OR trim(p_body_text) = '' THEN
    RAISE EXCEPTION 'body_text cannot be empty';
  END IF;

  -- Determine next version number.
  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.waivers
   WHERE tenant_id = p_tenant_id;

  -- Step 1: deactivate the current active waiver (if any).
  UPDATE public.waivers
     SET is_active = false
   WHERE tenant_id = p_tenant_id
     AND is_active = true;

  -- Step 2: insert the new version as active.
  -- The UPDATE in step 1 has already released the unique slot, so this
  -- insert satisfies idx_waivers_one_active_per_tenant.
  INSERT INTO public.waivers (tenant_id, version, body_text, effective_date, is_active)
  VALUES (p_tenant_id, v_next_version, p_body_text, p_effective_date, true)
  RETURNING id INTO v_new_id;

  RETURN QUERY
  SELECT v_new_id, v_next_version, p_effective_date;
END;
$$;

-- Only service-role (SECURITY DEFINER) may call this; revoke default public grant.
REVOKE EXECUTE ON FUNCTION public.publish_waiver_version(uuid, text, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.publish_waiver_version(uuid, text, date) TO service_role;
