-- Local rehearsal only: prerequisites for the unchanged canonical JWT hook.
-- Loaded after the base scheduler fixture, never against Supabase.
CREATE ROLE supabase_auth_admin;
ALTER TABLE auth.users ADD COLUMN raw_user_meta_data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE families ADD COLUMN role text NOT NULL DEFAULT 'parent';
CREATE TABLE super_admins(user_id uuid);
UPDATE auth.users SET raw_user_meta_data='{"app_role":"owner","tenant_slug":"one"}'
WHERE id='90000000-0000-0000-0000-000000000001';
