-- =============================================================================
-- Ballpark — Staff-led enrollment kiosk
-- Adds signature_image_path to family_waivers so staff can capture a drawn
-- signature via the owner portal and store the PNG path in Supabase Storage.
-- Also creates the waiver-signatures private storage bucket.
-- =============================================================================

-- 1. Add signature column to family_waivers
ALTER TABLE public.family_waivers
  ADD COLUMN IF NOT EXISTS signature_image_path text;

COMMENT ON COLUMN public.family_waivers.signature_image_path
  IS 'Storage path of the PNG signature captured during staff-led enrollment. Format: waiver-signatures/{tenant_id}/{family_id}/{waiver_id}.png';

-- 2. Storage bucket for waiver signatures (private — service-role only for read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waiver-signatures',
  'waiver-signatures',
  false,
  2097152,  -- 2 MB max per signature PNG
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage objects: only service-role (postgres) can SELECT/INSERT/UPDATE/DELETE
-- The bucket is private so the anon + authenticated policies below intentionally block
-- all access — staff uploads go through the service-role API route.
CREATE POLICY "waiver_signatures_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "waiver_signatures_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (false);
