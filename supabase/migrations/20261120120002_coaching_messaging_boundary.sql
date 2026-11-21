BEGIN;
-- Existing rows and read/viewed receipts remain intact. No adult CRM sending
-- approval has been granted; legacy kid-targeted staff writes cannot bypass
-- the phone UI through an older client or an owner service-client endpoint.
CREATE FUNCTION public.guard_coaching_message_boundary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.recipient_coach_user_id IS NULL THEN
    RAISE EXCEPTION 'instructor_messaging_requires_adult_policy_approval';
  END IF;
  -- Parent inbound communication remains guardian-authored, never a player
  -- impersonation or a service-client staff send disguised as parent inbound.
  IF NOT EXISTS (
    SELECT 1 FROM public.families f JOIN public.kids k ON k.family_id=f.id
    WHERE f.id=NEW.recipient_family_id AND k.id=NEW.recipient_kid_id
      AND f.tenant_id=NEW.tenant_id AND f.parent_user_id=NEW.sender_user_id
  ) THEN RAISE EXCEPTION 'guardian_message_identity_required'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER coaching_message_boundary
  BEFORE INSERT OR UPDATE OF sender_user_id,recipient_family_id,recipient_kid_id,recipient_coach_user_id,message_text,video_id,tenant_id
  ON public.coach_messages FOR EACH ROW EXECUTE FUNCTION public.guard_coaching_message_boundary();
COMMIT;
