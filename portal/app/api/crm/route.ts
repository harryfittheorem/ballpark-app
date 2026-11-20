import { crmContext } from '@/lib/crm/context';
import { makeCRMHandlers } from '@/lib/crm/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const { GET, POST } = makeCRMHandlers(crmContext);
