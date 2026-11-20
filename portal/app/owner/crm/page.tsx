import CRMWorkspace from '@/components/crm/CRMWorkspace';
export const metadata = { title: 'Staff CRM — Clubhouse' };
export default async function Page({ searchParams }: { searchParams: Promise<{preview?:string}> }) {
  const params = await searchParams;
  return <CRMWorkspace preview={params.preview === '1'} />;
}
