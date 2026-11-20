import { notFound, redirect } from 'next/navigation';
import { requireOwnerContext } from '@/lib/ownerAccess';
import { getScopedPlayer } from '@/lib/supabase/playerProfile';
import { playerHref } from '@/lib/playerLinks';

/** Legacy membership URLs remain valid, but every context uses one player route. */
export default async function MemberDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { client, tenantId } = await requireOwnerContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await client.from('memberships').select('id, kid_id, family_id')
    .eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (result.error) throw new Error('Unable to load membership. Please retry.');
  const membership = result.data;
  if (!membership) notFound();
  const player = await getScopedPlayer(client, tenantId, membership.kid_id);
  if (!player || !player.memberships.some(m => m.id === id)) notFound();
  const section = (await searchParams)?.section;
  redirect(playerHref({ kidId: membership.kid_id, membershipId: id },
    section === 'payment-history' || section === 'package-history' ? section : undefined)!);
}
