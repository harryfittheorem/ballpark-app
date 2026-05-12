import { createClient } from '@/lib/supabase/server';
import { readTenantId } from '@/lib/auth';
import { getMemberDetail } from '@/lib/supabase/ownerQueries';
import { MemberDetailContent } from './MemberDetailContent';
import { DEMO_MEMBER_DETAILS } from './demoMemberDetails';
import { notFound } from 'next/navigation';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const tenantId = readTenantId(session) ?? '';

  const detail = await getMemberDetail(supabase, tenantId, id);
  if (detail) return <MemberDetailContent member={detail} />;

  const demo = DEMO_MEMBER_DETAILS[id];
  if (demo) return <MemberDetailContent member={demo} />;

  return notFound();
}
