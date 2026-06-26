-- Replace partial unique index on sessions(capture_source, capture_session_id) with a
-- full unique index. PostgreSQL's ON CONFLICT clause cannot target a partial index unless
-- the WHERE predicate is also specified; Supabase JS upsert() does not support partial
-- index predicates in onConflict. Since NULL != NULL in SQL, a full unique index still
-- allows multiple rows with NULL capture_session_id (e.g. manual/booking sessions).

DROP INDEX IF EXISTS public.uniq_sessions_capture;

CREATE UNIQUE INDEX uniq_sessions_capture
  ON public.sessions (capture_source, capture_session_id);
