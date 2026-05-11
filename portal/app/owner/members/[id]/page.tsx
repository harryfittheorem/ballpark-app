import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getOwnerMembers } from '@/lib/supabase/ownerQueries';
import { MemberDetailContent } from './MemberDetailContent';
import { notFound } from 'next/navigation';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const members = await getOwnerMembers(supabase, tenantId);
  const member = members.find(m => m.id === id);
  if (!member) return notFound();

  return <MemberDetailContent member={member} />;
}
