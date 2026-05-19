/**
 * Owner portal — server-side data fetching layer.
 *
 * All functions accept a Supabase server client created from the owner's
 * session cookie.  Row-Level Security on every table restricts results to
 * the owner's own tenant automatically — no explicit tenant_id filter
 * required in most queries (though we add it for clarity & index usage).
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysSince(ts: string | null): number {
  if (!ts) return 9999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000);
}

function relativeTime(ts: string | null): string {
  if (!ts) return 'Never';
  const d = daysSince(ts);
  if (d === 0) return 'Today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

function churnRisk(daysSinceLastSession: number): 'low' | 'medium' | 'high' {
  if (daysSinceLastSession > 21) return 'high';
  if (daysSinceLastSession > 14) return 'medium';
  return 'low';
}

function engagementScore(daysSinceLastSession: number): number {
  return Math.max(0, Math.min(100, 100 - daysSinceLastSession * 4));
}

function nextChargeLabel(anchorDay: number | null, status: string): string {
  if (status !== 'active' || !anchorDay) return '—';
  const now = new Date();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let month = now.getMonth();
  if (now.getDate() >= anchorDay) {
    month += 1;
    if (month > 11) { month = 0; }
  }
  return `${months[month]} ${anchorDay}`;
}

function formatJoinDate(ts: string): string {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type OwnerMember = {
  id: string;
  kidId: string;
  name: string;
  age: string;
  parent: string;
  program: string;
  planType: 'eft' | 'otc';
  status: 'active' | 'at-risk' | 'paused' | 'cancelled' | 'payment_overdue';
  engagementScore: number;
  churnRisk: 'low' | 'medium' | 'high';
  lastSession: string;
  nextCharge: string;
  mrr: number;
  lifetime: number;
  joinedDate: string;
  riskReason?: string;
};

export type OwnerCoach = {
  id: string;
  userId: string | null;
  name: string;
  specialty: string;
  students: number;
  utilization: number;
  retention: number;
  avgRating: number;
  revenue: number;
  weeklyHours: number;
  joinedDate: string;
};

export type FailedPayment = {
  id: string;
  member: string;
  parent: string;
  amount: number;
  package: string;
  failedDate: string;
  failedAt: string;     // ISO timestamp used for stable chronological sorting
  reason: string;
  attempts: number;
  nextAttempt: string;
  source: 'membership' | 'store_order';
};

export type RevenueMonth = {
  month: string;
  eft: number;
  otc: number;
  total: number;
};

export type MembershipPackage = {
  name: string;
  planType: string;
  price: number;
  activeCount: number;
  mrr: number;
  pctRevenue: number;
  ltv: number;
};

export type OwnerKPIs = {
  mrr: number;
  activeMembers: number;
  totalMembers: number;
  failedPaymentsCount: number;
  atRiskCount: number;
  collectedMtd: number;
  autoPayRate: number;
  pastDue: number;
  retentionRate: number;
  sessionsToday: number;
  utilizationPct: number;
  paidToday: number;
  paidTodayCount: number;
  newSignupsMtd: number;
  newSignupsDelta: number;
  churnedMtd: number;
  churnedMrrImpact: number;
};

export type PointsProduct = {
  id: string;
  name: string;
  category: string;
  cost: number;
  inventory: number | null;
  fulfilled: number;
  pending: number;
};

export type OwnerDashboardData = {
  kpis: OwnerKPIs;
  members: OwnerMember[];
  revenueMonthly: RevenueMonth[];
  packages: MembershipPackage[];
  location: { name: string };
};

// ─── KPIs ───────────────────────────────────────────────────────────────────

export async function getOwnerKPIs(supabase: SupabaseClient, tenantId: string): Promise<OwnerKPIs> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);

  const [membershipsRes, failedRes, eventsRes, bookingsTodayRes, newSignupsRes, churnedMtdRes] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, status, amount_cents, kid_id, billing_anchor_day')
      .eq('tenant_id', tenantId),
    supabase
      .from('payment_events')
      .select('id, amount_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString()),
    supabase
      .from('payment_events')
      .select('amount_cents, status, created_at')
      .eq('tenant_id', tenantId),
    supabase
      .from('bookings')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('scheduled_start', dayStart.toISOString())
      .lte('scheduled_start', dayEnd.toISOString()),
    supabase
      .from('memberships')
      .select('id, started_at')
      .eq('tenant_id', tenantId)
      .gte('started_at', prevMonthStart.toISOString()),
    supabase
      .from('memberships')
      .select('id, amount_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'cancelled')
      .gte('cancelled_at', monthStart.toISOString()),
  ]);

  const memberships = membershipsRes.data ?? [];
  const active = memberships.filter(m => m.status === 'active');
  const mrr = active.reduce((s, m) => s + (m.amount_cents ?? 0), 0) / 100;
  const activeMembers = new Set(active.map(m => m.kid_id)).size;
  const totalMembers = new Set(memberships.map(m => m.kid_id)).size;

  // Retention rate: active memberships / all non-cancelled memberships
  const nonCancelled = memberships.filter(m => m.status !== 'cancelled');
  const retentionRate = nonCancelled.length > 0
    ? Math.round((active.length / nonCancelled.length) * 1000) / 10
    : 100;

  const events = eventsRes.data ?? [];
  const collectedMtd = events
    .filter(e => e.status === 'paid' && new Date(e.created_at) >= monthStart)
    .reduce((s, e) => s + (e.amount_cents ?? 0), 0) / 100;
  const failedMtd = events
    .filter(e => e.status === 'failed' && new Date(e.created_at) >= monthStart)
    .reduce((s, e) => s + (e.amount_cents ?? 0), 0) / 100;

  const totalMtd = collectedMtd + failedMtd;
  const autoPayRate = totalMtd > 0 ? Math.round((collectedMtd / totalMtd) * 1000) / 10 : 100;

  // Sessions today & utilization
  const sessionsToday = bookingsTodayRes.data?.length ?? 0;
  const TOTAL_SLOTS = 8 * 14; // 8 cages × 14 hours (9 AM–10 PM)
  const utilizationPct = Math.round((sessionsToday / TOTAL_SLOTS) * 1000) / 10;

  // Paid today
  const paidTodayEvents = events.filter(e => {
    if (e.status !== 'paid') return false;
    const ts = new Date(e.created_at);
    return ts >= dayStart && ts <= dayEnd;
  });
  const paidToday = paidTodayEvents.reduce((s, e) => s + (e.amount_cents ?? 0), 0) / 100;
  const paidTodayCount = paidTodayEvents.length;

  // New signups MTD vs prev month
  const recentSignups = newSignupsRes.data ?? [];
  const newSignupsMtd = recentSignups.filter(m => new Date(m.started_at) >= monthStart).length;
  const newSignupsPrevMonth = recentSignups.filter(m => {
    const d = new Date(m.started_at);
    return d >= prevMonthStart && d < monthStart;
  }).length;
  const newSignupsDelta = newSignupsMtd - newSignupsPrevMonth;

  // Churned MTD: memberships whose cancelled_at falls within the current calendar month
  const churnedRows = churnedMtdRes.data ?? [];
  const churnedMtd = churnedRows.length;
  const churnedMrrImpact = churnedRows.reduce((s, m) => s + (m.amount_cents ?? 0), 0) / 100;

  return {
    mrr,
    activeMembers,
    totalMembers,
    failedPaymentsCount: failedRes.data?.length ?? 0,
    atRiskCount: 0,
    collectedMtd,
    autoPayRate,
    pastDue: failedMtd,
    retentionRate,
    sessionsToday,
    utilizationPct,
    paidToday,
    paidTodayCount,
    newSignupsMtd,
    newSignupsDelta,
    churnedMtd,
    churnedMrrImpact,
  };
}

// ─── Members ────────────────────────────────────────────────────────────────

export async function getOwnerMembers(supabase: SupabaseClient, tenantId: string): Promise<OwnerMember[]> {
  const { data: rows, error } = await supabase
    .from('memberships')
    .select(`
      id,
      plan_name,
      plan_type,
      status,
      amount_cents,
      billing_anchor_day,
      started_at,
      kid_id,
      family_id,
      kids!inner(first_name, last_name, age_group),
      families!inner(parent_first_name, parent_last_name)
    `)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false });

  if (error || !rows) return [];

  const kidIds = [...new Set(rows.map(r => r.kid_id))];

  const { data: bookings } = await supabase
    .from('bookings')
    .select('kid_id, scheduled_start')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .in('kid_id', kidIds)
    .order('scheduled_start', { ascending: false });

  const { data: payments } = await supabase
    .from('payment_events')
    .select('membership_id, amount_cents, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid');

  const lastBookingByKid: Record<string, string> = {};
  for (const b of (bookings ?? [])) {
    if (!lastBookingByKid[b.kid_id]) lastBookingByKid[b.kid_id] = b.scheduled_start;
  }
  const lifetimeByMembership: Record<string, number> = {};
  for (const p of (payments ?? [])) {
    if (p.membership_id) {
      lifetimeByMembership[p.membership_id] = (lifetimeByMembership[p.membership_id] ?? 0) + p.amount_cents;
    }
  }

  return rows.map(r => {
    const kid = r.kids as unknown as { first_name: string; last_name: string | null; age_group: string | null };
    const fam = r.families as unknown as { parent_first_name: string; parent_last_name: string | null };
    const lastTs = lastBookingByKid[r.kid_id] ?? null;
    const days = daysSince(lastTs);
    const risk = churnRisk(days);
    const planType = r.plan_type as 'eft' | 'otc';
    const memberStatus = r.status === 'active' && risk === 'high' ? 'at-risk'
      : (r.status as 'active' | 'paused' | 'cancelled');

    return {
      id: r.id,
      kidId: r.kid_id,
      name: [kid.first_name, kid.last_name].filter(Boolean).join(' '),
      age: kid.age_group ?? '—',
      parent: [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' '),
      program: r.plan_name,
      planType,
      status: memberStatus,
      engagementScore: engagementScore(days),
      churnRisk: risk,
      lastSession: relativeTime(lastTs),
      nextCharge: nextChargeLabel(r.billing_anchor_day, r.status),
      mrr: r.amount_cents / 100,
      lifetime: (lifetimeByMembership[r.id] ?? 0) / 100,
      joinedDate: formatJoinDate(r.started_at),
      riskReason: risk === 'high'
        ? `No session in ${days} days. Outreach recommended within 48 hours.`
        : risk === 'medium'
        ? `No session in ${days} days. Send an engagement message.`
        : undefined,
    };
  });
}

// ─── Coaches ────────────────────────────────────────────────────────────────

export async function getOwnerCoaches(supabase: SupabaseClient, tenantId: string): Promise<OwnerCoach[]> {
  const { data: coaches, error } = await supabase
    .from('coaches')
    .select('id, user_id, first_name, last_name, is_active, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error || !coaches) return [];

  const coachIds = coaches.map(c => c.id);
  const { data: bookings } = await supabase
    .from('bookings')
    .select('coach_id, kid_id, status, scheduled_start')
    .eq('tenant_id', tenantId)
    .in('coach_id', coachIds)
    .gte('scheduled_start', new Date(Date.now() - 90 * 86_400_000).toISOString());

  const sessionsByCoach: Record<string, Set<string>> = {};
  const studentsByCoach: Record<string, Set<string>> = {};
  for (const b of (bookings ?? [])) {
    if (!sessionsByCoach[b.coach_id]) sessionsByCoach[b.coach_id] = new Set();
    sessionsByCoach[b.coach_id].add(b.scheduled_start);
    if (!studentsByCoach[b.coach_id]) studentsByCoach[b.coach_id] = new Set();
    studentsByCoach[b.coach_id].add(b.kid_id);
  }

  return coaches.map(c => {
    const sessions = sessionsByCoach[c.id]?.size ?? 0;
    const students = studentsByCoach[c.id]?.size ?? 0;
    const weeklyHours = Math.round((sessions / 13) * 1.5);
    const utilization = Math.min(100, Math.round((sessions / Math.max(sessions + 5, 40)) * 100));

    return {
      id: c.id,
      userId: (c as unknown as { user_id: string | null }).user_id ?? null,
      name: `${c.first_name} ${c.last_name}`,
      specialty: 'Hitting Coach',
      students,
      utilization,
      retention: 90,
      avgRating: 4.8,
      revenue: 0,
      weeklyHours,
      joinedDate: formatJoinDate(c.created_at ?? new Date().toISOString()),
    };
  });
}

// ─── Failed Payments ────────────────────────────────────────────────────────

export async function getFailedPayments(supabase: SupabaseClient, tenantId: string): Promise<FailedPayment[]> {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // ── Membership payment failures (recurring billing) ───────────────────────
  const { data: membershipFailures } = await supabase
    .from('payment_events')
    .select(`
      id, amount_cents, error_code, created_at,
      membership_id,
      memberships!inner(plan_name, kid_id, family_id,
        kids!inner(first_name, last_name),
        families!inner(parent_first_name, parent_last_name)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'failed')
    .order('created_at', { ascending: false });

  const membershipRows: FailedPayment[] = (membershipFailures ?? []).map((row, i) => {
    const mem = row.memberships as unknown as {
      plan_name: string;
      kids: { first_name: string; last_name: string | null };
      families: { parent_first_name: string; parent_last_name: string | null };
    };
    const kid = mem.kids;
    const fam = mem.families;
    const failedDate = new Date(row.created_at);
    const nextAttempt = new Date(failedDate.getTime() + 7 * 86_400_000);

    return {
      id: row.id,
      member: [kid.first_name, kid.last_name].filter(Boolean).join(' '),
      parent: [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' '),
      amount: row.amount_cents / 100,
      package: mem.plan_name,
      failedDate: `${months[failedDate.getMonth()]} ${failedDate.getDate()}`,
      failedAt: row.created_at,
      reason: row.error_code ?? 'Card declined',
      attempts: i + 1,
      nextAttempt: `${months[nextAttempt.getMonth()]} ${nextAttempt.getDate()}`,
      source: 'membership' as const,
    };
  });

  // ── Store order card payment failures ─────────────────────────────────────
  const { data: orderFailures } = await supabase
    .from('orders')
    .select(`
      id, amount_paid_cents, created_at, failure_reason,
      kid_id,
      kids!inner(first_name, last_name),
      families!inner(parent_first_name, parent_last_name),
      products!inner(name)
    `)
    .eq('tenant_id', tenantId)
    .eq('payment_method', 'card')
    .eq('status', 'payment_failed')
    .order('created_at', { ascending: false });

  const orderRows: FailedPayment[] = (orderFailures ?? []).map((row) => {
    const kid = row.kids as unknown as { first_name: string; last_name: string | null };
    const fam = row.families as unknown as { parent_first_name: string; parent_last_name: string | null };
    const product = row.products as unknown as { name: string };
    const rowWithReason = row as unknown as { failure_reason?: string | null };
    const failedDate = new Date(row.created_at);
    const nextAttempt = new Date(failedDate.getTime() + 3 * 86_400_000);

    return {
      id: row.id,
      member: [kid.first_name, kid.last_name].filter(Boolean).join(' '),
      parent: [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' '),
      amount: (row.amount_paid_cents ?? 0) / 100,
      package: product.name,
      failedDate: `${months[failedDate.getMonth()]} ${failedDate.getDate()}`,
      failedAt: row.created_at,
      reason: rowWithReason.failure_reason ?? 'Card declined',
      attempts: 1,
      nextAttempt: `${months[nextAttempt.getMonth()]} ${nextAttempt.getDate()}`,
      source: 'store_order' as const,
    };
  });

  // Merge and sort by raw ISO timestamp (stable, year-aware, locale-independent)
  return [...membershipRows, ...orderRows].sort(
    (a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime(),
  );
}

// ─── Monthly Revenue ─────────────────────────────────────────────────────────

export async function getMonthlyRevenue(supabase: SupabaseClient, tenantId: string): Promise<RevenueMonth[]> {
  const { data, error } = await supabase
    .from('payment_events')
    .select('amount_cents, payment_method, status, created_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid')
    .gte('created_at', new Date(Date.now() - 365 * 86_400_000).toISOString())
    .order('created_at');

  if (error || !data) return [];

  const byMonth: Record<string, RevenueMonth> = {};
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  for (const e of data) {
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    if (!byMonth[key]) {
      byMonth[key] = { month: monthLabels[d.getMonth()], eft: 0, otc: 0, total: 0 };
    }
    const cents = e.amount_cents / 100;
    if (e.payment_method === 'eft') byMonth[key].eft += cents;
    else byMonth[key].otc += cents;
    byMonth[key].total += cents;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ─── Membership Packages ─────────────────────────────────────────────────────

export async function getMembershipPackages(supabase: SupabaseClient, tenantId: string): Promise<MembershipPackage[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('plan_name, plan_type, amount_cents, status, started_at')
    .eq('tenant_id', tenantId);

  if (error || !data) return [];

  const byPlan: Record<string, { planType: string; price: number; activeCount: number; totalCents: number; startDates: string[] }> = {};

  for (const m of data) {
    if (!byPlan[m.plan_name]) {
      byPlan[m.plan_name] = { planType: m.plan_type, price: m.amount_cents / 100, activeCount: 0, totalCents: 0, startDates: [] };
    }
    if (m.status === 'active') byPlan[m.plan_name].activeCount += 1;
    byPlan[m.plan_name].totalCents += m.amount_cents;
    byPlan[m.plan_name].startDates.push(m.started_at);
  }

  const totalMrr = Object.values(byPlan).reduce(
    (s, p) => s + (p.planType === 'eft' ? p.price * p.activeCount : 0), 0
  );

  return Object.entries(byPlan).map(([name, p]) => {
    const mrr = p.planType === 'eft' ? p.price * p.activeCount : p.totalCents / 100;
    const pctRevenue = totalMrr > 0 ? Math.round((mrr / totalMrr) * 1000) / 10 : 0;
    const avgTenureMonths = 6;
    return {
      name,
      planType: p.planType,
      price: p.price,
      activeCount: p.activeCount,
      mrr,
      pctRevenue,
      ltv: Math.round(p.price * avgTenureMonths),
    };
  });
}

// ─── At-Risk Members ─────────────────────────────────────────────────────────

export async function getAtRiskMembers(supabase: SupabaseClient, tenantId: string): Promise<OwnerMember[]> {
  const members = await getOwnerMembers(supabase, tenantId);
  return members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium');
}

// ─── Missing in Action ───────────────────────────────────────────────────────

export type MiaGroups = {
  sevenDay: OwnerMember[];
  fourteenDay: OwnerMember[];
  thirtyDay: OwnerMember[];
};

export async function getMissingInAction(supabase: SupabaseClient, tenantId: string): Promise<MiaGroups> {
  const members = await getOwnerMembers(supabase, tenantId);
  const active = members.filter(m => m.status === 'active' || m.status === 'at-risk');

  const parse = (rel: string): number => {
    if (rel === 'Today') return 0;
    const m = rel.match(/^(\d+)d ago$/);
    return m ? parseInt(m[1]) : (rel === 'Never' ? 9999 : 0);
  };

  return {
    sevenDay: active.filter(m => parse(m.lastSession) >= 7 && parse(m.lastSession) < 14),
    fourteenDay: active.filter(m => parse(m.lastSession) >= 14 && parse(m.lastSession) < 30),
    thirtyDay: active.filter(m => parse(m.lastSession) >= 30),
  };
}

// ─── Billing Data ────────────────────────────────────────────────────────────

export type RecentTransaction = {
  id: string;
  date: string;
  member: string;
  package: string;
  amount: number;
  method: string;
  status: 'paid' | 'failed' | 'refunded';
};

export type BillingData = {
  kpis: OwnerKPIs;
  packages: MembershipPackage[];
  recentTransactions: RecentTransaction[];
  paidCount: number;
  failedCount: number;
};

/**
 * Fetches billing KPIs and package breakdown from the database.
 *
 * NOTE — MRR sourcing: this function computes MRR from DB payment_events/memberships
 * (historical, not real-time). The billing page server component overrides the mrr KPI
 * with live Stripe subscription data via `fetchLocationMrr` when Stripe is configured.
 * If you reuse this function elsewhere and need authoritative live MRR, supplement it
 * with `fetchLocationMrr` from `@/lib/stripe/mrrUtils` and override kpis.mrr there too.
 */
export async function getBillingData(supabase: SupabaseClient, tenantId: string): Promise<BillingData> {
  const [kpis, packages] = await Promise.all([
    getOwnerKPIs(supabase, tenantId),
    getMembershipPackages(supabase, tenantId),
  ]);

  const { data: events } = await supabase
    .from('payment_events')
    .select(`
      id, amount_cents, payment_method, status, created_at,
      memberships(plan_name, kids(first_name, last_name))
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(20);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const recentTransactions: RecentTransaction[] = (events ?? []).map(e => {
    const mem = e.memberships as unknown as { plan_name: string; kids: { first_name: string; last_name: string | null } | null } | null;
    const d = new Date(e.created_at);
    const memberName = mem?.kids
      ? [mem.kids.first_name, mem.kids.last_name].filter(Boolean).join(' ')
      : '—';
    return {
      id: e.id,
      date: `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`,
      member: memberName,
      package: mem?.plan_name ?? '—',
      amount: e.amount_cents / 100,
      method: e.payment_method.toUpperCase(),
      status: e.status as 'paid' | 'failed' | 'refunded',
    };
  });

  const paidCount = (events ?? []).filter(e => e.status === 'paid').length;
  const failedCount = (events ?? []).filter(e => e.status === 'failed').length;

  return { kpis, packages, recentTransactions, paidCount, failedCount };
}

// ─── Revenue Reports ─────────────────────────────────────────────────────────

export type RevenueReportsData = {
  eftVsOtc: { eftTotal: number; otcTotal: number; eftCount: number; otcCount: number };
  monthly: RevenueMonth[];
  packages: MembershipPackage[];
  cohortRetention: Array<{ cohort: string; size: number; retention: number[] }>;
};

export async function getRevenueReportsData(supabase: SupabaseClient, tenantId: string): Promise<RevenueReportsData> {
  const [monthly, packages] = await Promise.all([
    getMonthlyRevenue(supabase, tenantId),
    getMembershipPackages(supabase, tenantId),
  ]);

  const eftTotal = monthly.reduce((s, m) => s + m.eft, 0);
  const otcTotal = monthly.reduce((s, m) => s + m.otc, 0);
  const eftCount = packages.filter(p => p.planType === 'eft').reduce((s, p) => s + p.activeCount, 0);
  const otcCount = packages.filter(p => p.planType === 'otc').reduce((s, p) => s + p.activeCount, 0);

  const { data: memberships } = await supabase
    .from('memberships')
    .select('started_at, status')
    .eq('tenant_id', tenantId)
    .order('started_at');

  const cohortMap: Record<string, { total: number; active: number }> = {};
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  for (const m of (memberships ?? [])) {
    const d = new Date(m.started_at);
    const key = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`;
    if (!cohortMap[key]) cohortMap[key] = { total: 0, active: 0 };
    cohortMap[key].total += 1;
    if (m.status === 'active') cohortMap[key].active += 1;
  }

  const cohortRetention = Object.entries(cohortMap).map(([cohort, { total, active }]) => ({
    cohort,
    size: total,
    retention: [100, Math.round((active / total) * 100)],
  }));

  return {
    eftVsOtc: { eftTotal, otcTotal, eftCount, otcCount },
    monthly,
    packages,
    cohortRetention,
  };
}

// ─── Points & Rewards ───────────────────────────────────────────────────────

export type PointsRewardsData = {
  products: PointsProduct[];
  totalPointsIssued: number;
  topEarners: Array<{ name: string; points: number }>;
};

export async function getPointsRewardsData(supabase: SupabaseClient, tenantId: string): Promise<PointsRewardsData> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, category, points_cost, inventory_count, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .eq('is_redeemable', true)
    .order('sort_order');

  const { data: orders } = await supabase
    .from('orders')
    .select('product_id, status')
    .eq('tenant_id', tenantId)
    .eq('payment_method', 'points');

  const fulfilledByProduct: Record<string, number> = {};
  const pendingByProduct: Record<string, number> = {};
  for (const o of (orders ?? [])) {
    if (o.status === 'fulfilled') {
      fulfilledByProduct[o.product_id] = (fulfilledByProduct[o.product_id] ?? 0) + 1;
    } else if (o.status === 'ordered') {
      pendingByProduct[o.product_id] = (pendingByProduct[o.product_id] ?? 0) + 1;
    }
  }

  const { data: ledger } = await supabase
    .from('points_ledger')
    .select('delta, kid_id, kids(first_name)')
    .eq('tenant_id', tenantId)
    .gt('delta', 0);

  const totalPointsIssued = (ledger ?? []).reduce((s, l) => s + (l.delta ?? 0), 0);

  const earnerMap: Record<string, number> = {};
  for (const l of (ledger ?? [])) {
    const k = l.kids as unknown as { first_name: string } | null;
    const name = k?.first_name ?? 'Unknown';
    earnerMap[name] = (earnerMap[name] ?? 0) + (l.delta ?? 0);
  }
  const topEarners = Object.entries(earnerMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([name, points]) => ({ name, points }));

  return {
    products: (products ?? []).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category ?? 'General',
      cost: p.points_cost ?? 0,
      inventory: p.inventory_count,
      fulfilled: fulfilledByProduct[p.id] ?? 0,
      pending: pendingByProduct[p.id] ?? 0,
    })),
    totalPointsIssued,
    topEarners,
  };
}

// ─── Retention ───────────────────────────────────────────────────────────────

export type RetentionData = {
  retentionRate: number;
  avgLifetimeMonths: number;
  cohortRetention: Array<{ cohort: string; size: number; retention: number[] }>;
  churnReasons: Array<{ reason: string; count: number; pct: number }>;
};

export async function getRetentionData(supabase: SupabaseClient, tenantId: string): Promise<RetentionData> {
  const { data: memberships } = await supabase
    .from('memberships')
    .select('started_at, cancelled_at, status')
    .eq('tenant_id', tenantId);

  const rows = memberships ?? [];
  const totalActive = rows.filter(m => m.status === 'active').length;
  const total = rows.length;
  const retentionRate = total > 0 ? Math.round((totalActive / total) * 1000) / 10 : 100;

  const avgLifetimeMonths = rows.length > 0
    ? Math.round(rows.reduce((s, m) => {
        const end = m.cancelled_at ? new Date(m.cancelled_at) : new Date();
        const months = (end.getTime() - new Date(m.started_at).getTime()) / (30 * 86_400_000);
        return s + months;
      }, 0) / rows.length * 10) / 10
    : 0;

  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const cohortMap: Record<string, { total: number; active: number }> = {};
  for (const m of rows) {
    const d = new Date(m.started_at);
    const key = `${monthLabels[d.getMonth()]} ${d.getFullYear()}`;
    if (!cohortMap[key]) cohortMap[key] = { total: 0, active: 0 };
    cohortMap[key].total += 1;
    if (m.status === 'active') cohortMap[key].active += 1;
  }

  const cohortRetention = Object.entries(cohortMap).map(([cohort, { total, active }]) => ({
    cohort,
    size: total,
    retention: [100, Math.round((active / total) * 100)],
  }));

  const churnReasons = [
    { reason: 'Schedule conflict / too busy', count: 0, pct: 0 },
  ];

  return { retentionRate, avgLifetimeMonths, cohortRetention, churnReasons };
}

// ─── Schedule ───────────────────────────────────────────────────────────────

export type ScheduleBooking = {
  id: string;
  kidName: string;
  coachName: string;
  scheduledStart: string;
  scheduledEnd: string;
  cage: string | null;
  sessionType: string;
  status: string;
};

export type OwnerScheduleData = {
  bookings: ScheduleBooking[];
  totalToday: number;
  occupancyPct: number;
  openSlots: number;
};

export async function getOwnerScheduleData(
  supabase: SupabaseClient,
  tenantId: string,
  date: Date = new Date(),
): Promise<OwnerScheduleData> {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: raw, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id, scheduled_start, scheduled_end, cage_number, status,
      session_types(name),
      kids(first_name, last_name),
      coaches(first_name, last_name)
    `)
    .eq('tenant_id', tenantId)
    .gte('scheduled_start', dayStart.toISOString())
    .lte('scheduled_start', dayEnd.toISOString())
    .order('scheduled_start');

  if (bookingError) {
    console.error('[getOwnerScheduleData] bookings query failed:', bookingError.message);
  }

  const bookings: ScheduleBooking[] = (raw ?? []).map(b => {
    const kid = b.kids as unknown as { first_name: string; last_name: string | null } | null;
    const coach = b.coaches as unknown as { first_name: string; last_name: string | null } | null;
    const st = b.session_types as unknown as { name: string } | null;
    return {
      id: b.id,
      kidName: kid ? [kid.first_name, kid.last_name].filter(Boolean).join(' ') : 'Unknown',
      coachName: coach ? [coach.first_name, coach.last_name].filter(Boolean).join(' ') : '—',
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end ?? b.scheduled_start,
      cage: b.cage_number ? `Cage ${b.cage_number}` : null,
      sessionType: st?.name ?? 'Private',
      status: b.status,
    };
  });

  const TOTAL_SLOTS = 8 * 14; // 8 cages × 14 hours (9 AM–10 PM)
  const occupancyPct = Math.round((bookings.length / TOTAL_SLOTS) * 1000) / 10;

  return {
    bookings,
    totalToday: bookings.length,
    occupancyPct,
    openSlots: TOTAL_SLOTS - bookings.length,
  };
}

// ─── Member Detail ───────────────────────────────────────────────────────────

export type BookingStatus = 'completed' | 'cancelled' | 'confirmed' | 'pending' | 'no_show';
export type PaymentStatus = 'paid' | 'failed' | 'refunded';

export type TimelineEvent = {
  id: string;
  kind: 'booking' | 'payment';
  dateIso: string;
  dateLabel: string;
  title: string;
  subtitle: string;
  status: BookingStatus | PaymentStatus;
  amount?: number;
};

export type RecentPaymentEvent = {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'failed' | 'refunded';
  method: string;
};

export type MemberDetail = OwnerMember & {
  bookingCount: number;
  hittraxSessionCount: number;
  pointsBalance: number;
  timeline: TimelineEvent[];
  recentPayments: RecentPaymentEvent[];
  stripeSubscriptionId: string | null;
  subscriptionStatus: 'active' | 'past_due' | 'payment_overdue' | 'cancelled' | 'none';
  nextBillingAt: string | null;
  /** ISO timestamp when a cancel_at_period_end subscription will terminate. Null if not pending cancellation. */
  cancelAt: string | null;
};

export async function getMemberDetail(
  supabase: SupabaseClient,
  tenantId: string,
  membershipId: string,
): Promise<MemberDetail | null> {
  const { data: mem, error: memErr } = await supabase
    .from('memberships')
    .select(`
      id,
      plan_name,
      plan_type,
      status,
      amount_cents,
      billing_anchor_day,
      started_at,
      kid_id,
      family_id,
      stripe_subscription_id,
      next_billing_at,
      cancel_at,
      kids!inner(id, first_name, last_name, age_group, points_balance),
      families!inner(parent_first_name, parent_last_name)
    `)
    .eq('tenant_id', tenantId)
    .eq('id', membershipId)
    .single();

  if (memErr || !mem) return null;

  const kid = mem.kids as unknown as {
    id: string;
    first_name: string;
    last_name: string | null;
    age_group: string | null;
    points_balance: number;
  };
  const fam = mem.families as unknown as {
    parent_first_name: string;
    parent_last_name: string | null;
  };

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const dateLabel = (iso: string) => {
    const d = new Date(iso);
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const [bookingCountRes, sessionsRes, recentBookingsRes, paymentsRes, lastBookingRes] = await Promise.all([
    // Exact completed-booking count — no row limit so all completed bookings are counted
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('kid_id', kid.id)
      .eq('status', 'completed'),
    // HitTrax session count
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('kid_id', kid.id),
    // Recent bookings for the timeline (last 5)
    supabase
      .from('bookings')
      .select('id, scheduled_start, status, session_types(name), coaches(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('kid_id', kid.id)
      .order('scheduled_start', { ascending: false })
      .limit(5),
    // Payment events — last 5 for timeline + last 3 for billing card
    supabase
      .from('payment_events')
      .select('id, amount_cents, payment_method, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('membership_id', membershipId)
      .order('created_at', { ascending: false })
      .limit(5),
    // Last completed booking for churn-risk / engagement scoring
    supabase
      .from('bookings')
      .select('scheduled_start')
      .eq('tenant_id', tenantId)
      .eq('kid_id', kid.id)
      .eq('status', 'completed')
      .order('scheduled_start', { ascending: false })
      .limit(1),
  ]);

  const bookingCount = bookingCountRes.count ?? 0;
  const hittraxSessionCount = sessionsRes.count ?? 0;

  if (bookingCountRes.error) console.error('[getMemberDetail] bookingCount:', bookingCountRes.error.message);
  if (sessionsRes.error) console.error('[getMemberDetail] sessions:', sessionsRes.error.message);
  if (recentBookingsRes.error) console.error('[getMemberDetail] recentBookings:', recentBookingsRes.error.message);
  if (paymentsRes.error) console.error('[getMemberDetail] payments:', paymentsRes.error.message);
  if (lastBookingRes.error) console.error('[getMemberDetail] lastBooking:', lastBookingRes.error.message);

  // Build unified timeline: merge recent bookings + payment events, sort descending
  const knownBookingStatuses = new Set<BookingStatus>(['completed','cancelled','confirmed','pending','no_show']);
  const knownPaymentStatuses = new Set<PaymentStatus>(['paid','failed','refunded']);

  const bookingEvents: TimelineEvent[] = (recentBookingsRes.data ?? []).map(b => {
    const coach = b.coaches as unknown as { first_name: string; last_name: string | null } | null;
    const st = b.session_types as unknown as { name: string } | null;
    const status: BookingStatus = knownBookingStatuses.has(b.status as BookingStatus)
      ? (b.status as BookingStatus)
      : 'pending';
    return {
      id: b.id,
      kind: 'booking' as const,
      dateIso: b.scheduled_start,
      dateLabel: dateLabel(b.scheduled_start),
      title: st?.name ?? 'Private Session',
      subtitle: coach ? `Coach ${[coach.first_name, coach.last_name].filter(Boolean).join(' ')}` : 'Session',
      status,
    };
  });

  const paymentTimelineEvents: TimelineEvent[] = (paymentsRes.data ?? []).map(e => {
    const status: PaymentStatus = knownPaymentStatuses.has(e.status as PaymentStatus)
      ? (e.status as PaymentStatus)
      : 'paid';
    return {
      id: e.id,
      kind: 'payment' as const,
      dateIso: e.created_at,
      dateLabel: dateLabel(e.created_at),
      title: status === 'paid' ? 'Payment received' : status === 'failed' ? 'Payment failed' : 'Payment refunded',
      subtitle: `$${(e.amount_cents / 100).toFixed(2)} · ${(e.payment_method ?? 'eft').toUpperCase()}`,
      status,
      amount: e.amount_cents / 100,
    };
  });

  const timeline: TimelineEvent[] = [...bookingEvents, ...paymentTimelineEvents]
    .sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime())
    .slice(0, 8);

  const recentPayments: RecentPaymentEvent[] = (paymentsRes.data ?? []).slice(0, 3).map(e => {
    return {
      id: e.id,
      date: dateLabel(e.created_at),
      amount: e.amount_cents / 100,
      status: e.status as 'paid' | 'failed' | 'refunded',
      method: (e.payment_method ?? 'eft').toUpperCase(),
    };
  });

  const lastBookingTs = lastBookingRes.data?.[0]?.scheduled_start ?? null;
  const days = daysSince(lastBookingTs);
  const risk = churnRisk(days);
  const planType = mem.plan_type as 'eft' | 'otc';
  const rawStatus = mem.status as string;
  const memberStatus = rawStatus === 'active' && risk === 'high' ? 'at-risk'
    : (rawStatus as 'active' | 'paused' | 'cancelled' | 'payment_overdue');

  // Subscription billing fields (Phase 3)
  const stripeSubscriptionId = (mem.stripe_subscription_id as string | null) ?? null;
  const nextBillingAt = (mem.next_billing_at as string | null) ?? null;
  let subscriptionStatus: MemberDetail['subscriptionStatus'] = 'none';
  if (stripeSubscriptionId) {
    if (rawStatus === 'active') subscriptionStatus = 'active';
    else if (rawStatus === 'payment_overdue') subscriptionStatus = 'payment_overdue';
    else if (rawStatus === 'cancelled') subscriptionStatus = 'cancelled';
    else subscriptionStatus = 'active';
  }

  const lifetimeRes = await supabase
    .from('payment_events')
    .select('amount_cents')
    .eq('tenant_id', tenantId)
    .eq('membership_id', membershipId)
    .eq('status', 'paid');
  const lifetime = (lifetimeRes.data ?? []).reduce((s, e) => s + (e.amount_cents ?? 0), 0) / 100;

  return {
    id: mem.id,
    kidId: kid.id,
    name: [kid.first_name, kid.last_name].filter(Boolean).join(' '),
    age: kid.age_group ?? '—',
    parent: [fam.parent_first_name, fam.parent_last_name].filter(Boolean).join(' '),
    program: mem.plan_name,
    planType,
    status: memberStatus,
    engagementScore: engagementScore(days),
    churnRisk: risk,
    lastSession: relativeTime(lastBookingTs),
    nextCharge: nextChargeLabel(mem.billing_anchor_day, mem.status),
    mrr: mem.amount_cents / 100,
    lifetime,
    joinedDate: formatJoinDate(mem.started_at),
    riskReason: risk === 'high'
      ? `No session in ${days} days. Outreach recommended within 48 hours.`
      : risk === 'medium'
      ? `No session in ${days} days. Send an engagement message.`
      : undefined,
    bookingCount,
    hittraxSessionCount,
    pointsBalance: kid.points_balance,
    timeline,
    recentPayments,
    stripeSubscriptionId,
    subscriptionStatus,
    nextBillingAt,
    cancelAt: (mem.cancel_at as string | null) ?? null,
  };
}

// ─── Tenant / Location Name ──────────────────────────────────────────────────

export async function getTenantName(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single();
  return data?.name ?? 'Your Location';
}

/**
 * Look up a tenant name by slug using a service-role client (bypasses RLS).
 * Used as a fallback when the caller's JWT lacks a `tenant_id` claim — e.g.
 * sessions issued before the custom_access_token_hook was updated for
 * owner/admin accounts.
 */
export async function getTenantNameBySlug(
  serviceSupabase: SupabaseClient,
  slug: string,
): Promise<string> {
  const { data } = await serviceSupabase
    .from('tenants')
    .select('name')
    .eq('slug', slug)
    .single();
  return data?.name ?? 'Your Location';
}

// ─── Location Stripe Status ───────────────────────────────────────────────────

export type LocationStripeStatus = {
  id: string;
  name: string;
  stripe_account_id: string | null;
  stripe_onboarding_status: 'not_connected' | 'pending' | 'connected' | 'restricted';
  stripe_account_name: string | null;
  stripe_payout_interval: string | null;
};

export async function getLocationsStripeStatus(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<LocationStripeStatus[]> {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, stripe_account_id, stripe_onboarding_status, stripe_account_name, stripe_payout_interval')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error || !data) return [];

  return data.map(row => ({
    id: row.id as string,
    name: row.name as string,
    stripe_account_id: (row.stripe_account_id as string | null) ?? null,
    stripe_onboarding_status: ((row.stripe_onboarding_status as string | null) ?? 'not_connected') as LocationStripeStatus['stripe_onboarding_status'],
    stripe_account_name: (row.stripe_account_name as string | null) ?? null,
    stripe_payout_interval: (row.stripe_payout_interval as string | null) ?? null,
  }));
}

/** Convenience: returns the first location's stripe status (for dashboard banner). */
export async function getLocationStripeStatus(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<LocationStripeStatus | null> {
  const all = await getLocationsStripeStatus(supabase, tenantId);
  return all[0] ?? null;
}
