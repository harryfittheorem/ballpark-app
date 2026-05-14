import { createClient } from '@/lib/supabase/server';
import {
  getHQNetworkKPIs,
  getHQLocationRevenue,
  getHQRecentTransactions,
} from '@/lib/supabase/hqQueries';
import { HQRevenueContent } from './HQRevenueContent';

export default async function HQRevenuePage() {
  const supabase = await createClient();
  const [kpis, locationRevenue, recentTransactions] = await Promise.all([
    getHQNetworkKPIs(supabase),
    getHQLocationRevenue(supabase),
    getHQRecentTransactions(supabase, 15),
  ]);
  return <HQRevenueContent kpis={kpis} locationRevenue={locationRevenue} recentTransactions={recentTransactions} />;
}
