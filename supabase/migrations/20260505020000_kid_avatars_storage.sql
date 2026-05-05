-- =============================================================================
-- kid-avatars storage bucket + RLS policies
-- =============================================================================
-- Public bucket so the existing kids.avatar_url column can be a plain URL.
-- Writes are scoped: a parent may only insert/update/delete objects under a
-- top-level folder whose name matches a family.id they own.
-- Path convention: <family_id>/<kid_id>/<filename>
-- =============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('kid-avatars', 'kid-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS kid_avatars_read_all ON storage.objects;
CREATE POLICY kid_avatars_read_all ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'kid-avatars');

DROP POLICY IF EXISTS kid_avatars_insert_own_family ON storage.objects;
CREATE POLICY kid_avatars_insert_own_family ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kid-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS kid_avatars_update_own_family ON storage.objects;
CREATE POLICY kid_avatars_update_own_family ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kid-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.families WHERE parent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'kid-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.families WHERE parent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS kid_avatars_delete_own_family ON storage.objects;
CREATE POLICY kid_avatars_delete_own_family ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kid-avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.families WHERE parent_user_id = auth.uid()
    )
  );
