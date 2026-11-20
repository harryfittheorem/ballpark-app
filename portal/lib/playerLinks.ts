export type PlayerReference = {
  kidId?: string | null;
  membershipId?: string | null;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** IDs only. A display name is never evidence of a player relationship. */
export function playerHref(reference: PlayerReference, section?: 'payment-history' | 'package-history'): string | null {
  if (!reference.kidId || !uuid.test(reference.kidId)) return null;
  const query = reference.membershipId && uuid.test(reference.membershipId)
    ? `?membership=${reference.membershipId}` : '';
  return `/owner/players/${reference.kidId}${query}${section ? `#${section}` : ''}`;
}
