/**
 * Coach messages API helpers.
 *
 * v0.4 Step 4.9 only needs read-side helpers for the recipient picker.
 * Inserting into `coach_messages` lands in Step 4.10. RLS already lets a
 * coach SELECT every kid + family in their tenant via the
 * `kids_select_coach_stub` / `families_select_coach_stub` policies
 * (see 20260505040800_rename_role_to_app_role_in_jwt.sql), so this file
 * doesn't need to filter by tenant_id client-side.
 */

import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

/**
 * Flat row returned by `listTenantKids`, denormalised so the recipient
 * picker can render a row + group by family without an N+1 fetch.
 */
export type TenantKid = {
  kidId: string;
  firstName: string;
  lastName: string;
  ageGroup: string | null;
  avatarUrl: string | null;
  familyId: string;
  familyLastName: string;
  parentFirstName: string;
  parentLastName: string;
};

type KidWithFamilyRow = Pick<
  Tables<'kids'>,
  'id' | 'first_name' | 'last_name' | 'age_group' | 'avatar_url' | 'family_id'
> & {
  family:
    | Pick<
        Tables<'families'>,
        'id' | 'parent_first_name' | 'parent_last_name'
      >
    | null;
};

/**
 * Fetch every kid the coach can see (RLS scopes by tenant) along with the
 * family info needed to group + label rows. Sorted by family last name,
 * then kid first name — sorting happens client-side because PostgREST can't
 * `order` by an embedded resource's column.
 */
export async function listTenantKids(): Promise<TenantKid[]> {
  const { data, error } = await supabase
    .from('kids')
    .select(
      'id, first_name, last_name, age_group, avatar_url, family_id, family:families!inner(id, parent_first_name, parent_last_name)',
    );
  if (error) throw error;

  const rows = (data ?? []) as unknown as KidWithFamilyRow[];

  const mapped: TenantKid[] = rows
    .filter((r): r is KidWithFamilyRow & { family: NonNullable<KidWithFamilyRow['family']> } => !!r.family)
    .map((r) => ({
      kidId: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      ageGroup: r.age_group,
      avatarUrl: r.avatar_url,
      familyId: r.family.id,
      familyLastName: r.family.parent_last_name,
      parentFirstName: r.family.parent_first_name,
      parentLastName: r.family.parent_last_name,
    }));

  mapped.sort((a, b) => {
    const fam = a.familyLastName.localeCompare(b.familyLastName, undefined, {
      sensitivity: 'base',
    });
    if (fam !== 0) return fam;
    return a.firstName.localeCompare(b.firstName, undefined, {
      sensitivity: 'base',
    });
  });

  return mapped;
}
