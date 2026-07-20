import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readTenantId } from '@/lib/auth';
import { getMemberDetail, getBookingFormOptions } from '@/lib/supabase/ownerQueries';
import { MemberDetailContent } from './MemberDetailContent';
import { DEMO_MEMBER_DETAILS } from './demoMemberDetails';
import { notFound } from 'next/navigation';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const _userClient = await createClient();
  const supabase = createServiceClient();
  const { data: { session } } = await _userClient.auth.getSession();
  const tenantId = readTenantId(session) ?? process.env.PORTAL_TENANT_ID ?? '';

  const [detail, bookingOptions] = await Promise.all([
    getMemberDetail(supabase, tenantId, id),
    getBookingFormOptions(supabase, tenantId),
  ]);

  if (detail) {
    const { data: activeWaiver } = await supabase
      .from('waivers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .maybeSingle();

    let waiverStatus: 'signed' | 'unsigned' | 'outdated' | null = null;
    let waiverSignedAt: string | null = null;

    if (activeWaiver?.id) {
      const { data: signedRecord } = await supabase
        .from('family_waivers')
        .select('signed_at')
        .eq('family_id', detail.familyId)
        .eq('waiver_id', activeWaiver.id)
        .maybeSingle();

      if (signedRecord) {
        waiverStatus = 'signed';
        waiverSignedAt = signedRecord.signed_at;
      } else {
        const { data: anyRecord } = await supabase
          .from('family_waivers')
          .select('id')
          .eq('family_id', detail.familyId)
          .limit(1)
          .maybeSingle();

        waiverStatus = anyRecord ? 'outdated' : 'unsigned';
      }
    }

    return (
      <MemberDetailContent
        member={detail}
        bookingOptions={bookingOptions}
        waiverStatus={waiverStatus}
        waiverSignedAt={waiverSignedAt}
      />
    );
  }

  const demo = DEMO_MEMBER_DETAILS[id];
  if (demo) return <MemberDetailContent member={demo} bookingOptions={bookingOptions} />;

  return notFound();
}
