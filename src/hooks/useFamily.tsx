/**
 * Family + kids hook.
 *
 * Fetches the parent's family row and their kids on session change.
 * Exposes callbacks to insert / update / delete kids and upload kid avatars
 * (RLS-protected by family_id).
 *
 * Lightweight hand-rolled state — we'll fold this into TanStack Query when
 * the broader data layer lands (v0.2). For Step 1.6 we just need to know
 * "does this family already have a kid?" so the root nav can decide between
 * AddKid and the tab shell.
 */

import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';

import { useAuth } from './useAuth';

type Family = Tables<'families'>;
type Kid = Tables<'kids'>;

const KID_AVATAR_BUCKET = 'kid-avatars';

type FamilyState = {
  family: Family | null;
  kids: Kid[];
  loading: boolean;
  error: Error | null;
};

const initial: FamilyState = { family: null, kids: [], loading: true, error: null };

let memoState: FamilyState = initial;
const listeners = new Set<(s: FamilyState) => void>();
let activeUserId: string | null = null;

function setState(next: Partial<FamilyState>) {
  memoState = { ...memoState, ...next };
  listeners.forEach((l) => l(memoState));
}

async function refresh(userId: string) {
  setState({ loading: true, error: null });
  const { data: family, error: famErr } = await supabase
    .from('families')
    .select('*')
    .eq('parent_user_id', userId)
    .maybeSingle();

  if (famErr) {
    setState({ loading: false, error: famErr });
    return;
  }
  if (!family) {
    setState({ family: null, kids: [], loading: false });
    return;
  }
  const { data: kids, error: kidErr } = await supabase
    .from('kids')
    .select('*')
    .eq('family_id', family.id)
    .order('created_at', { ascending: true });

  if (kidErr) {
    setState({ family, kids: [], loading: false, error: kidErr });
    return;
  }
  setState({ family, kids: kids ?? [], loading: false });
}

async function ensureFamily(userId: string): Promise<Family> {
  let family = memoState.family;
  if (!family || family.parent_user_id !== userId) {
    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('parent_user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Family not found — auth hook may have failed');
    family = data;
  }
  return family;
}

/**
 * Reads an ImagePicker asset, uploads it to the kid-avatars bucket under
 * <family_id>/<kid_id>/<timestamp>.<ext>, and returns the public URL.
 */
async function uploadKidAvatar(
  familyId: string,
  kidId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
  const path = `${familyId}/${kidId}/${Date.now()}.${ext}`;
  const contentType = asset.mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  // Read file as bytes — RN fetch().blob() is unreliable on Hermes; ArrayBuffer works.
  const res = await fetch(asset.uri);
  const arrayBuffer = await res.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(KID_AVATAR_BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(KID_AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function useFamily() {
  const { user } = useAuth();
  const [state, setLocal] = useState<FamilyState>(memoState);

  useEffect(() => {
    listeners.add(setLocal);
    return () => {
      listeners.delete(setLocal);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      activeUserId = null;
      memoState = initial;
      setLocal(initial);
      return;
    }
    if (activeUserId !== user.id) {
      activeUserId = user.id;
      // Clear stale data from a previous account before async refresh so
      // we never render one user's family/kids under another user's session.
      memoState = { family: null, kids: [], loading: true, error: null };
      listeners.forEach((l) => l(memoState));
      void refresh(user.id);
    }
  }, [user]);

  return state;
}

export function useAddKid() {
  const { user } = useAuth();
  return useCallback(
    async (
      input: Omit<TablesInsert<'kids'>, 'family_id' | 'avatar_url'>,
      avatar?: ImagePicker.ImagePickerAsset | null,
    ) => {
      if (!user) throw new Error('Not authenticated');
      const family = await ensureFamily(user.id);
      const { data: inserted, error: insertErr } = await supabase
        .from('kids')
        .insert({ ...input, family_id: family.id })
        .select('*')
        .single();
      if (insertErr) throw insertErr;

      // Kid row exists at this point. If avatar upload fails, we still want
      // the UI to reflect the new kid — refresh in `finally` and surface the
      // avatar error as a non-fatal warning rather than rolling back.
      try {
        if (avatar && inserted) {
          const url = await uploadKidAvatar(family.id, inserted.id, avatar);
          const { error: updErr } = await supabase
            .from('kids')
            .update({ avatar_url: url })
            .eq('id', inserted.id);
          if (updErr) throw updErr;
        }
      } catch (avatarErr) {
        // Re-throw so the caller can show a message — but only after
        // refresh runs in `finally`, so the kid still appears in the UI.
        throw new Error(
          `Kid added, but avatar upload failed: ${
            avatarErr instanceof Error ? avatarErr.message : 'Unknown error'
          }`,
        );
      } finally {
        await refresh(user.id);
      }
    },
    [user],
  );
}

export function useUpdateKid() {
  const { user } = useAuth();
  return useCallback(
    async (
      kidId: string,
      patch: TablesUpdate<'kids'>,
      avatar?: ImagePicker.ImagePickerAsset | null,
    ) => {
      if (!user) throw new Error('Not authenticated');
      const family = await ensureFamily(user.id);

      let nextPatch: TablesUpdate<'kids'> = patch;
      if (avatar) {
        const url = await uploadKidAvatar(family.id, kidId, avatar);
        nextPatch = { ...patch, avatar_url: url };
      }
      const { error } = await supabase
        .from('kids')
        .update(nextPatch)
        .eq('id', kidId)
        .eq('family_id', family.id);
      if (error) throw error;
      await refresh(user.id);
    },
    [user],
  );
}

export function useDeleteKid() {
  const { user } = useAuth();
  return useCallback(
    async (kidId: string) => {
      if (!user) throw new Error('Not authenticated');
      const family = await ensureFamily(user.id);
      const { error } = await supabase
        .from('kids')
        .delete()
        .eq('id', kidId)
        .eq('family_id', family.id);
      if (error) throw error;
      await refresh(user.id);
    },
    [user],
  );
}
