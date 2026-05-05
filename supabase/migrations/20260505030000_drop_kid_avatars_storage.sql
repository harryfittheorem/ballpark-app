-- =============================================================================
-- Drop kid-avatars storage bucket + RLS policies (revert of Task #7)
-- =============================================================================
-- Task #7 (multi-kid editing) was reverted. The kid-avatars bucket and its
-- policies are no longer used in v0.1 scope. This migration removes them.
-- =============================================================================

DROP POLICY IF EXISTS kid_avatars_read_all ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_insert_own_family ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_update_own_family ON storage.objects;
DROP POLICY IF EXISTS kid_avatars_delete_own_family ON storage.objects;

-- Note: the kid-avatars bucket itself was deleted via the Supabase Storage
-- REST API (DELETE /storage/v1/bucket/kid-avatars) because Supabase blocks
-- direct DELETE on storage.buckets / storage.objects from SQL. This migration
-- only drops the RLS policies that referenced it.
