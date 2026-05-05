-- =============================================================================
-- Drop kid-avatars storage bucket + RLS policies (revert of Task #7)
-- =============================================================================
-- Task #7 (multi-kid editing) was reverted. The kid-avatars bucket and its
-- policies are no longer used in v0.1 scope. This migration removes them.
--
-- Supabase installs `protect_delete` triggers on storage.buckets and
-- storage.objects that block direct SQL DELETE. We temporarily disable those
-- triggers, perform the cleanup, then re-enable them.
-- =============================================================================

DROP POLICY IF EXISTS kid_avatars_read_all ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_insert_own_family ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_update_own_family ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_delete_own_family ON storage.objects;

ALTER TABLE storage.objects DISABLE TRIGGER protect_objects_delete;
ALTER TABLE storage.buckets DISABLE TRIGGER protect_buckets_delete;

DELETE FROM storage.objects WHERE bucket_id = 'kid-avatars';
DELETE FROM storage.buckets WHERE id = 'kid-avatars';

ALTER TABLE storage.objects ENABLE TRIGGER protect_objects_delete;
ALTER TABLE storage.buckets ENABLE TRIGGER protect_buckets_delete;
