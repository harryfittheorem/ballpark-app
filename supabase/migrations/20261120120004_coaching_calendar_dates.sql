BEGIN;
-- A date-only game/measurement can be recorded from any phone timezone.
-- Evaluate "today" against the latest currently valid civil date (UTC+14),
-- not the database's UTC date, which rejects evening entries east of UTC.
-- Timestamp instants and persisted date values themselves are unchanged.
ALTER FUNCTION public.save_coaching_record(uuid,text,uuid,jsonb)
  SET timezone = 'Pacific/Kiritimati';
COMMIT;
