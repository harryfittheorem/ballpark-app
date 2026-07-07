import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getMemberDetail } from '@/lib/supabase/ownerQueries';
import { MemberDetailContent } from './MemberDetailContent';
import { DEMO_MEMBER_DETAILS } from './demoMemberDetails';
import { notFound } from 'next/navigation';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  const detail = await getMemberDetail(supabase, tenantId, id);
  if (detail) return <MemberDetailContent member={detail} />;

  const demo = DEMO_MEMBER_DETAILS[id];
  if (demo) return <MemberDetailContent member={demo} />;

  return notFound();
}
