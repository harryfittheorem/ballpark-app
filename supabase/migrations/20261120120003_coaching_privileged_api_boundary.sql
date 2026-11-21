BEGIN;
-- Supabase projects commonly grant new tables to service_role by default.
-- The coaching functions run as their database owner; application service
-- clients do not need raw access. In particular, a generic manager/export
-- endpoint must not inherit readership of author-only private lesson notes.
REVOKE ALL ON public.private_lesson_notes,public.coaching_write_receipts,public.coaching_audit
  FROM service_role;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.coaching_measurements,public.self_reported_games,public.lesson_ratings
  FROM service_role;
REVOKE ALL ON FUNCTION public.coaching_history_immutable(),public.guard_coaching_message_boundary()
  FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
