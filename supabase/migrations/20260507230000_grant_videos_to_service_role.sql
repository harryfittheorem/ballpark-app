-- Grant base table privileges to service_role on public.videos.
--
-- Why this is needed: the mux-create-upload and mux-webhook Edge Functions
-- both use the service-role client to read and write public.videos (lookup
-- existing rows by mux_asset_id, insert the initial 'uploading' row,
-- update with the real asset id / playback id / status). Without these
-- GRANTs, every call returns Postgres error 42501 ("permission denied for
-- table videos"), which the function surfaces to the client as
-- `Failed to query videos [db_error]`.
--
-- The earlier 20260505041500 grants migration only covered the
-- `authenticated` and `anon` roles — `service_role` was never wired up,
-- and the bug was masked until now because the Edge Functions had never
-- been deployed to the linked project (see also: replit.md Gotchas on
-- redeploying functions). Service role bypasses RLS but still respects
-- table-level GRANTs.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO service_role;
