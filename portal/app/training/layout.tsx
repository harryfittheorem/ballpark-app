import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/PortalShell';
import { trainingContext } from '@/lib/training/server';
import { TrainingError } from '@/lib/training/validation';
import { getCoachCapabilities, isStaffPreset } from '@/lib/auth';

export const metadata={title:'Training Playbook · Ballpark'};
export const dynamic='force-dynamic';
export default async function TrainingLayout({children}:{children:ReactNode}) {
  let ctx;
  try {ctx=await trainingContext();} catch(error) {
    if(error instanceof TrainingError)redirect('/login?reason=unauthenticated');
    throw error;
  }
  const {data:tenant}=await ctx.db.from('tenants').select('name').eq('id',ctx.tenantId).single();
  const staff=ctx.role==='coach' ? isStaffPreset(await getCoachCapabilities(ctx.db,ctx.userId)) : false;
  return <PortalShell role={ctx.role} email={ctx.email} locationName={tenant?.name ?? 'Training'} isStaff={staff}>{children}</PortalShell>;
}
