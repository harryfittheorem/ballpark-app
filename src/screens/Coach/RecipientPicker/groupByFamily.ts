/**
 * Pure helper: turn the flat `TenantKid[]` returned by `listTenantKids`
 * into a SectionList-friendly array of family sections. Input is assumed
 * to already be sorted by family last name, then kid first name (the API
 * layer guarantees this), so we just walk it and bucket by `familyId`.
 */

import type { TenantKid } from '@/api/coachMessages';

export type FamilySection = {
  familyId: string;
  familyLastName: string;
  kids: TenantKid[];
};

export function groupByFamily(rows: TenantKid[]): FamilySection[] {
  const sections: FamilySection[] = [];
  const indexById = new Map<string, number>();

  for (const kid of rows) {
    const idx = indexById.get(kid.familyId);
    if (idx === undefined) {
      indexById.set(kid.familyId, sections.length);
      sections.push({
        familyId: kid.familyId,
        familyLastName: kid.familyLastName,
        kids: [kid],
      });
    } else {
      sections[idx].kids.push(kid);
    }
  }

  return sections;
}
