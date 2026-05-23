-- =============================================================================
-- Ballpark v0.8 — Digital waiver + consent capture
-- =============================================================================
-- Tables: waivers (catalog), family_waivers (log)
-- RPC:    sign_waiver(p_waiver_id, p_app_version) — SECURITY DEFINER, idempotent
-- RLS:    families read active waivers in own tenant; INSERT only via RPC;
--         admins/service role full access
-- Seed:   v1 Infinite Hitting liability waiver (is_active = true)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. waivers catalog
-- -----------------------------------------------------------------------------
CREATE TABLE public.waivers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version        integer     NOT NULL CHECK (version > 0),
  body_text      text        NOT NULL,
  effective_date date        NOT NULL DEFAULT CURRENT_DATE,
  is_active      boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

CREATE INDEX idx_waivers_tenant_id ON public.waivers(tenant_id);
CREATE INDEX idx_waivers_active    ON public.waivers(tenant_id, is_active) WHERE is_active = true;

-- Enforce at most one active waiver per tenant so .maybeSingle() never panics
CREATE UNIQUE INDEX idx_waivers_one_active_per_tenant
  ON public.waivers(tenant_id)
  WHERE is_active = true;


-- -----------------------------------------------------------------------------
-- 2. family_waivers log
-- -----------------------------------------------------------------------------
CREATE TABLE public.family_waivers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  waiver_id   uuid        NOT NULL REFERENCES public.waivers(id)  ON DELETE CASCADE,
  signed_at   timestamptz NOT NULL DEFAULT now(),
  app_version text,
  ip_address  text,
  UNIQUE (family_id, waiver_id)
);

CREATE INDEX idx_family_waivers_family_id ON public.family_waivers(family_id);
CREATE INDEX idx_family_waivers_waiver_id ON public.family_waivers(waiver_id);


-- -----------------------------------------------------------------------------
-- 3. Base table privileges (required before RLS policy evaluation)
-- Without these, PostgREST returns 42501 before even reaching RLS.
-- See migration 20260505041500_grant_table_privileges_to_authenticated.sql
-- for the project precedent.
-- -----------------------------------------------------------------------------
GRANT SELECT                    ON public.waivers        TO authenticated;
GRANT SELECT                    ON public.family_waivers TO authenticated;
-- INSERT on family_waivers is intentionally withheld from authenticated;
-- all writes go through the sign_waiver SECURITY DEFINER RPC.


-- -----------------------------------------------------------------------------
-- 4. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.waivers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_waivers ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read waivers for their own tenant
CREATE POLICY waivers_select_own_tenant ON public.waivers
  FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Families may SELECT their own waiver records
CREATE POLICY family_waivers_select_own ON public.family_waivers
  FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT id FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

-- Direct INSERT is blocked — all writes go through sign_waiver RPC
CREATE POLICY family_waivers_no_direct_insert ON public.family_waivers
  FOR INSERT TO authenticated
  WITH CHECK (false);


-- -----------------------------------------------------------------------------
-- 4. sign_waiver RPC — SECURITY DEFINER, idempotent
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sign_waiver(
  p_waiver_id   uuid,
  p_app_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id        uuid;
  v_tenant_id        uuid;
  v_waiver_tenant_id uuid;
BEGIN
  -- Resolve caller's family_id and tenant_id from JWT custom claims
  v_family_id := (auth.jwt() ->> 'family_id')::uuid;
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::uuid;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'sign_waiver: caller is not a parent (no family_id in JWT)';
  END IF;

  -- Verify the waiver belongs to the caller's tenant (prevent cross-tenant signing)
  SELECT tenant_id
    INTO v_waiver_tenant_id
    FROM public.waivers
   WHERE id = p_waiver_id;

  IF v_waiver_tenant_id IS NULL THEN
    RAISE EXCEPTION 'sign_waiver: waiver not found';
  END IF;

  IF v_waiver_tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'sign_waiver: cross-tenant waiver signing is not allowed';
  END IF;

  -- Idempotent insert — subsequent calls for the same (family, waiver) pair are no-ops
  INSERT INTO public.family_waivers (family_id, waiver_id, app_version)
  VALUES (v_family_id, p_waiver_id, p_app_version)
  ON CONFLICT (family_id, waiver_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.sign_waiver(uuid, text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.sign_waiver(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.sign_waiver(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- 5. Seed: v1 Infinite Hitting Liability Waiver
-- Deterministic UUID in 5eed namespace so seed data is identifiable.
-- -----------------------------------------------------------------------------
INSERT INTO public.waivers (id, tenant_id, version, body_text, effective_date, is_active)
VALUES (
  '5eed0000-0000-0000-0001-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000001'::uuid,
  1,
  E'INFINITE HITTING BASEBALL ACADEMY\nLIABILITY WAIVER, RELEASE, AND ASSUMPTION OF RISK\n\nEffective Date: June 1, 2026\n\nPLEASE READ THIS DOCUMENT CAREFULLY. BY AGREEING BELOW, YOU ARE GIVING UP CERTAIN LEGAL RIGHTS.\n\n1. PARTIES\n\nThis Liability Waiver ("Waiver") is entered into between Infinite Hitting Baseball Academy ("Academy") and the undersigned parent or legal guardian ("Participant") on behalf of the minor child or athlete named in this account ("Athlete").\n\n2. ACTIVITIES COVERED\n\nThis Waiver applies to all activities at or arranged by the Academy, including but not limited to: batting cage sessions, pitching lessons, strength and conditioning training, group clinics, team practices, HitTrax technology sessions, field rentals, tournaments, camps, and any other programs or events offered by or through the Academy (collectively, "Activities").\n\n3. ASSUMPTION OF RISK\n\nParticipant acknowledges that the Activities involve inherent risks of physical injury, including but not limited to: being struck by a baseball or softball, collisions with other participants or equipment, falls, muscle strains, fractures, and other injuries that may result from participation in baseball or softball activities. Participant voluntarily assumes all such risks on behalf of the Athlete.\n\n4. RELEASE OF LIABILITY\n\nIn consideration of the Athlete being permitted to participate in the Activities, Participant, on behalf of themselves, the Athlete, and their respective heirs, personal representatives, and assigns, hereby releases, waives, discharges, and covenants not to sue the Academy, its owners, officers, directors, employees, coaches, agents, volunteers, sponsors, and facility owners (collectively, "Released Parties") from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, injury, or death that may be sustained by the Athlete, or to any property belonging to the Athlete, whether caused by the negligence of the Released Parties or otherwise, while the Athlete is participating in the Activities or is on the premises of the Academy.\n\n5. INDEMNIFICATION\n\nParticipant agrees to indemnify and hold harmless the Released Parties from any loss, liability, damage, or cost that may incur due to the Athlete''s participation in the Activities, whether caused by the negligence of the Released Parties or otherwise.\n\n6. MEDICAL AUTHORIZATION\n\nIn the event of an emergency, Participant hereby authorizes the Academy''s staff to seek emergency medical treatment for the Athlete if Participant cannot be reached. Participant agrees to be responsible for all costs associated with such medical treatment.\n\n7. MEDIA RELEASE\n\nParticipant grants the Academy permission to use the Athlete''s name, image, and likeness in photographs, videos, and other media for promotional and educational purposes without compensation, unless Participant opts out in writing to the Academy.\n\n8. CODE OF CONDUCT\n\nParticipant agrees that the Athlete will conduct themselves in a sportsmanlike manner at all times. The Academy reserves the right to remove any Athlete from the premises or program for conduct deemed inappropriate, unsafe, or disruptive, without refund.\n\n9. HEALTH DISCLOSURE\n\nParticipant represents that the Athlete is in good physical health and has no medical conditions that would prevent safe participation in the Activities. Participant agrees to notify the Academy of any changes to the Athlete''s health status that may affect their participation.\n\n10. SEVERABILITY\n\nIf any provision of this Waiver is found to be unenforceable, the remaining provisions shall remain in full force and effect.\n\n11. GOVERNING LAW\n\nThis Waiver shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of laws provisions. Any disputes arising under this Waiver shall be resolved in the courts of Dallas County, Texas.\n\n12. ACKNOWLEDGMENT\n\nBy tapping "I Agree" in the Ballpark mobile application, Participant represents that:\n\n(a) They are the parent or legal guardian of the Athlete and have the authority to enter into this agreement;\n(b) They have read and understand the full contents of this Waiver;\n(c) They agree to all terms and conditions stated herein;\n(d) This electronic agreement is legally binding and has the same force and effect as a handwritten signature.\n\nQuestions? Contact us at info@infinitehitting.com.',
  '2026-06-01',
  true
)
ON CONFLICT (id) DO NOTHING;
