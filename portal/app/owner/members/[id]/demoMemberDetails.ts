import type { MemberDetail, TimelineEvent, RecentPaymentEvent } from '@/lib/supabase/ownerQueries';

export type DemoMemberDetail = Omit<MemberDetail,
  'stripeSubscriptionId' | 'subscriptionStatus' | 'nextBillingAt' |
  'pauseStart' | 'pauseEnd' | 'pausedAt' |
  'cardLast4' | 'cardBrand' | 'cardExpMonth' | 'cardExpYear' |
  'sessionsRemaining' | 'sessionsTotal' |
  'weeklySessionsUsed' | 'weeklyTotal' | 'weeklyPeriodStart'
> & {
  memberForMonths: number;
  bestVeloMph: number;
  homeworkScore: number;
  parentEmail: string;
  parentPhone: string;
  paymentMethod: string;
  hittraxAvgExitVelo: number;
  hittraxBestVelo: number;
  hittraxLaunchAngle: number;
  sparklinePoints: number[];
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: MemberDetail['subscriptionStatus'];
  nextBillingAt?: string | null;
  pauseStart?: string | null;
  pauseEnd?: string | null;
  pausedAt?: string | null;
  cardLast4?: string | null;
  cardBrand?: string | null;
  cardExpMonth?: number | null;
  cardExpYear?: number | null;
  sessionsRemaining?: number | null;
  sessionsTotal?: number | null;
  weeklySessionsUsed?: number | null;
  weeklyTotal?: number | null;
  weeklyPeriodStart?: string | null;
};

function tl(id: string, kind: 'booking' | 'payment', daysAgo: number, title: string, subtitle: string, status: 'completed' | 'confirmed' | 'pending' | 'cancelled' | 'paid' | 'failed', amount?: number): TimelineEvent {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const label = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${months[d.getMonth()]} ${d.getDate()}`;
  return { id, kind, dateIso: d.toISOString(), dateLabel: label, title, subtitle, status, amount };
}

function pmt(id: string, daysAgo: number, amount: number, status: 'paid' | 'failed' | 'refunded', method: string): RecentPaymentEvent {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return { id, date: `${months[d.getMonth()]} ${d.getDate()}`, amount, status, method };
}

export const DEMO_MEMBER_DETAILS: Record<string, DemoMemberDetail> = {
  d00: {
    id: 'd00', kidId: 'k00', name: 'Alex Owner Jr.', age: '12U', parent: 'Owner Demo',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 38,
    churnRisk: 'high', lastSession: '31d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 2240, joinedDate: 'May 2024',
    riskReason: '31 days without a session and one failed payment. This is your owner test account — use it to verify email delivery.',
    memberForMonths: 24, bookingCount: 14, hittraxSessionCount: 7, pointsBalance: 410,
    bestVeloMph: 62, homeworkScore: 4, parentEmail: 'owner@infinitehitting.com', parentPhone: '(214) 555-0001',
    paymentMethod: 'Visa ·0001', hittraxAvgExitVelo: 59.5, hittraxBestVelo: 62, hittraxLaunchAngle: 12,
    sparklinePoints: [56, 57, 58, 59, 60, 61, 62, 61, 60, 59],
    timeline: [
      tl('t1', 'payment', 4, 'Payment failed', 'Unlimited Monthly — Card declined', 'failed', 280),
      tl('t2', 'booking', 31, 'Last session', 'Private · Coach Mike · Cage 1', 'completed'),
      tl('t3', 'booking', 45, 'Session completed', 'Private · Coach Mike · Cage 3', 'completed'),
      tl('t4', 'payment', 35, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
    ],
    recentPayments: [pmt('p1', 4, 280, 'failed', 'Visa ·0001'), pmt('p2', 35, 280, 'paid', 'Visa ·0001')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d01: {
    id: 'd01', kidId: 'k01', name: 'Jake Martinez', age: '12U', parent: 'Carlos Martinez',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 92,
    churnRisk: 'low', lastSession: '2d ago', nextCharge: 'Jun 1', mrr: 280, lifetime: 3920, joinedDate: 'Jan 2025',
    memberForMonths: 16, bookingCount: 27, hittraxSessionCount: 14, pointsBalance: 1250,
    bestVeloMph: 68, homeworkScore: 8, parentEmail: 'carlos.m@email.com', parentPhone: '(214) 555-8123',
    paymentMethod: 'Visa ·4242', hittraxAvgExitVelo: 65.2, hittraxBestVelo: 68, hittraxLaunchAngle: 13,
    sparklinePoints: [58, 60, 59, 62, 63, 64, 63, 65, 65, 68],
    timeline: [
      tl('t1', 'booking', 2, 'Session scheduled', 'Hitting with Coach Mike · Cage 3', 'confirmed'),
      tl('t2', 'booking', 3, 'Earned 25 points', 'Completed homework: Tee drills', 'completed'),
      tl('t3', 'booking', 15, 'New personal best', 'Exit velo: 68 mph (was 66)', 'completed'),
      tl('t4', 'booking', 18, 'Session completed', 'Private · Coach Mike · Cage 1', 'completed'),
      tl('t5', 'payment', 5, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
    ],
    recentPayments: [pmt('p1', 5, 280, 'paid', 'Visa ·4242'), pmt('p2', 35, 280, 'paid', 'Visa ·4242'), pmt('p3', 65, 280, 'paid', 'Visa ·4242')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d02: {
    id: 'd02', kidId: 'k02', name: 'Tyler Johnson', age: '14U', parent: 'Brad Johnson',
    program: 'Team Training', planType: 'eft', status: 'active', engagementScore: 60,
    churnRisk: 'high', lastSession: '23d ago', nextCharge: 'Jun 5', mrr: 450, lifetime: 5480, joinedDate: 'Mar 2024',
    riskReason: '23 days since last session.',
    memberForMonths: 26, bookingCount: 41, hittraxSessionCount: 22, pointsBalance: 780,
    bestVeloMph: 74, homeworkScore: 5, parentEmail: 'brad.j@email.com', parentPhone: '(972) 555-4401',
    paymentMethod: 'Visa ·8891', hittraxAvgExitVelo: 71.8, hittraxBestVelo: 74, hittraxLaunchAngle: 15,
    sparklinePoints: [68, 70, 71, 72, 73, 72, 74, 73, 71, 70],
    timeline: [
      tl('t1', 'booking', 23, 'Last session', 'Team Training · Cage 2', 'completed'),
      tl('t2', 'payment', 10, 'Payment processed', 'Team Training — Auto-pay', 'paid', 450),
      tl('t3', 'booking', 30, 'Session completed', 'Team Training · Coach Alex', 'completed'),
      tl('t4', 'booking', 37, 'Session completed', 'Team Training · Coach Alex', 'completed'),
    ],
    recentPayments: [pmt('p1', 10, 450, 'paid', 'Visa ·8891'), pmt('p2', 40, 450, 'paid', 'Visa ·8891')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d03: {
    id: 'd03', kidId: 'k03', name: 'Marcus Williams', age: '10U', parent: 'Darius Williams',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 41,
    churnRisk: 'high', lastSession: '28d ago', nextCharge: 'Overdue', mrr: 280, lifetime: 1680, joinedDate: 'Sep 2024',
    riskReason: '28 days without a session plus a failed payment.',
    memberForMonths: 20, bookingCount: 12, hittraxSessionCount: 6, pointsBalance: 320,
    bestVeloMph: 55, homeworkScore: 4, parentEmail: 'darius.w@email.com', parentPhone: '(469) 555-7722',
    paymentMethod: 'Visa ·3310', hittraxAvgExitVelo: 52.4, hittraxBestVelo: 55, hittraxLaunchAngle: 11,
    sparklinePoints: [50, 51, 52, 53, 54, 53, 55, 54, 52, 51],
    timeline: [
      tl('t1', 'payment', 3, 'Payment failed', 'Unlimited Monthly — Card declined', 'failed', 280),
      tl('t2', 'booking', 28, 'Last session', 'Private · Coach Mike', 'completed'),
      tl('t3', 'booking', 42, 'Session completed', 'Private · Coach Mike', 'completed'),
      tl('t4', 'payment', 33, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
    ],
    recentPayments: [pmt('p1', 3, 280, 'failed', 'Visa ·3310'), pmt('p2', 33, 280, 'paid', 'Visa ·3310')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d04: {
    id: 'd04', kidId: 'k04', name: 'Ryan Chen', age: '11U', parent: 'David Chen',
    program: '8-Pack Lessons', planType: 'otc', status: 'active', engagementScore: 85,
    churnRisk: 'low', lastSession: '5d ago', nextCharge: '—', mrr: 0, lifetime: 1280, joinedDate: 'Feb 2025',
    memberForMonths: 15, bookingCount: 18, hittraxSessionCount: 9, pointsBalance: 640,
    bestVeloMph: 61, homeworkScore: 9, parentEmail: 'd.chen@email.com', parentPhone: '(817) 555-3305',
    paymentMethod: 'Visa ·5544', hittraxAvgExitVelo: 59.1, hittraxBestVelo: 61, hittraxLaunchAngle: 14,
    sparklinePoints: [55, 56, 57, 58, 59, 60, 60, 61, 60, 61],
    timeline: [
      tl('t1', 'booking', 5, 'Session completed', 'Private · Coach Mike · Cage 1', 'completed'),
      tl('t2', 'booking', 8, 'Earned 25 points', 'Completed homework: Hip rotation drills', 'completed'),
      tl('t3', 'booking', 14, 'Session completed', 'Private · Coach Mike · Cage 3', 'completed'),
      tl('t4', 'payment', 21, 'Payment processed', '8-Pack Lessons — one-time', 'paid', 640),
    ],
    recentPayments: [pmt('p1', 21, 640, 'paid', 'Visa ·5544')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d05: {
    id: 'd05', kidId: 'k05', name: 'Ethan Brooks', age: '13U', parent: 'Kevin Brooks',
    program: 'Cage Rental Monthly', planType: 'eft', status: 'active', engagementScore: 63,
    churnRisk: 'medium', lastSession: '16d ago', nextCharge: 'Jun 3', mrr: 120, lifetime: 960, joinedDate: 'Jul 2024',
    riskReason: 'Attendance dropped significantly vs prior months.',
    memberForMonths: 22, bookingCount: 22, hittraxSessionCount: 0, pointsBalance: 410,
    bestVeloMph: 66, homeworkScore: 6, parentEmail: 'k.brooks@email.com', parentPhone: '(214) 555-9988',
    paymentMethod: 'MC ·7731', hittraxAvgExitVelo: 63.5, hittraxBestVelo: 66, hittraxLaunchAngle: 16,
    sparklinePoints: [61, 63, 64, 65, 66, 65, 64, 63, 64, 63],
    timeline: [
      tl('t1', 'booking', 16, 'Cage rental', 'Cage 2 · 60 min', 'completed'),
      tl('t2', 'payment', 8, 'Payment processed', 'Cage Rental Monthly — Auto-pay', 'paid', 120),
      tl('t3', 'booking', 30, 'Cage rental', 'Cage 1 · 60 min', 'completed'),
      tl('t4', 'booking', 38, 'Cage rental', 'Cage 3 · 60 min', 'completed'),
    ],
    recentPayments: [pmt('p1', 8, 120, 'paid', 'MC ·7731'), pmt('p2', 38, 120, 'paid', 'MC ·7731')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d06: {
    id: 'd06', kidId: 'k06', name: 'Noah Patel', age: '11U', parent: 'Raj Patel',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 55,
    churnRisk: 'medium', lastSession: '15d ago', nextCharge: 'Jun 8', mrr: 280, lifetime: 2240, joinedDate: 'Jun 2024',
    memberForMonths: 23, bookingCount: 19, hittraxSessionCount: 8, pointsBalance: 520,
    bestVeloMph: 60, homeworkScore: 5, parentEmail: 'r.patel@email.com', parentPhone: '(972) 555-2267',
    paymentMethod: 'Visa ·6612', hittraxAvgExitVelo: 57.9, hittraxBestVelo: 60, hittraxLaunchAngle: 12,
    sparklinePoints: [55, 56, 57, 58, 59, 60, 59, 58, 59, 58],
    timeline: [
      tl('t1', 'booking', 15, 'Session completed', 'Private · Coach Alex · Cage 2', 'completed'),
      tl('t2', 'payment', 5, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
      tl('t3', 'booking', 28, 'Session cancelled', 'Private · Coach Alex', 'cancelled'),
      tl('t4', 'booking', 35, 'Session completed', 'Private · Coach Alex · Cage 1', 'completed'),
    ],
    recentPayments: [pmt('p1', 5, 280, 'paid', 'Visa ·6612'), pmt('p2', 35, 280, 'paid', 'Visa ·6612')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d07: {
    id: 'd07', kidId: 'k07', name: 'Logan Scott', age: '9U', parent: 'James Scott',
    program: '4-Pack Lessons', planType: 'otc', status: 'active', engagementScore: 78,
    churnRisk: 'low', lastSession: '4d ago', nextCharge: '—', mrr: 0, lifetime: 720, joinedDate: 'Mar 2025',
    memberForMonths: 14, bookingCount: 8, hittraxSessionCount: 3, pointsBalance: 290,
    bestVeloMph: 48, homeworkScore: 7, parentEmail: 'j.scott@email.com', parentPhone: '(469) 555-0044',
    paymentMethod: 'Visa ·9901', hittraxAvgExitVelo: 45.2, hittraxBestVelo: 48, hittraxLaunchAngle: 10,
    sparklinePoints: [42, 43, 44, 45, 46, 46, 47, 48, 47, 48],
    timeline: [
      tl('t1', 'booking', 4, 'Session completed', 'Private · Coach Mike · Cage 1', 'completed'),
      tl('t2', 'booking', 8, 'Earned 25 points', 'Completed homework: Stance drills', 'completed'),
      tl('t3', 'payment', 30, 'Payment processed', '4-Pack Lessons — one-time', 'paid', 320),
    ],
    recentPayments: [pmt('p1', 30, 320, 'paid', 'Visa ·9901')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d08: {
    id: 'd08', kidId: 'k08', name: 'Aiden Torres', age: '12U', parent: 'Maria Torres',
    program: 'Team Training', planType: 'eft', status: 'active', engagementScore: 88,
    churnRisk: 'low', lastSession: '1d ago', nextCharge: 'Jun 2', mrr: 450, lifetime: 4050, joinedDate: 'Apr 2024',
    memberForMonths: 25, bookingCount: 35, hittraxSessionCount: 18, pointsBalance: 1480,
    bestVeloMph: 70, homeworkScore: 9, parentEmail: 'm.torres@email.com', parentPhone: '(817) 555-5533',
    paymentMethod: 'Visa ·2278', hittraxAvgExitVelo: 67.4, hittraxBestVelo: 70, hittraxLaunchAngle: 14,
    sparklinePoints: [62, 64, 65, 66, 67, 68, 68, 69, 70, 70],
    timeline: [
      tl('t1', 'booking', 1, 'Session completed', 'Team Training · Coach Alex · Cage 2', 'completed'),
      tl('t2', 'booking', 3, 'New personal best', 'Exit velo: 70 mph (was 68)', 'completed'),
      tl('t3', 'payment', 7, 'Payment processed', 'Team Training — Auto-pay', 'paid', 450),
      tl('t4', 'booking', 8, 'Session completed', 'Team Training · Coach Alex', 'completed'),
    ],
    recentPayments: [pmt('p1', 7, 450, 'paid', 'Visa ·2278'), pmt('p2', 37, 450, 'paid', 'Visa ·2278')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d09: {
    id: 'd09', kidId: 'k09', name: 'Caleb Nguyen', age: '13U', parent: 'Linh Nguyen',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 95,
    churnRisk: 'low', lastSession: 'Today', nextCharge: 'Jun 10', mrr: 280, lifetime: 5040, joinedDate: 'Nov 2023',
    memberForMonths: 30, bookingCount: 52, hittraxSessionCount: 28, pointsBalance: 2310,
    bestVeloMph: 76, homeworkScore: 10, parentEmail: 'l.nguyen@email.com', parentPhone: '(214) 555-6677',
    paymentMethod: 'MC ·4488', hittraxAvgExitVelo: 73.1, hittraxBestVelo: 76, hittraxLaunchAngle: 15,
    sparklinePoints: [68, 70, 71, 72, 73, 74, 74, 75, 75, 76],
    timeline: [
      tl('t1', 'booking', 0, 'Session in progress', 'Private · Coach Mike · Cage 1', 'confirmed'),
      tl('t2', 'booking', 3, 'New personal best', 'Exit velo: 76 mph (was 74)', 'completed'),
      tl('t3', 'booking', 5, 'Session completed', 'Private · Coach Mike · Cage 2', 'completed'),
      tl('t4', 'payment', 6, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
    ],
    recentPayments: [pmt('p1', 6, 280, 'paid', 'MC ·4488'), pmt('p2', 36, 280, 'paid', 'MC ·4488')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d10: {
    id: 'd10', kidId: 'k10', name: 'Jaxon Rivera', age: '10U', parent: 'Sofia Rivera',
    program: 'Cage Rental Monthly', planType: 'eft', status: 'active', engagementScore: 70,
    churnRisk: 'low', lastSession: '7d ago', nextCharge: 'Jun 6', mrr: 120, lifetime: 1080, joinedDate: 'Aug 2024',
    memberForMonths: 21, bookingCount: 16, hittraxSessionCount: 0, pointsBalance: 380,
    bestVeloMph: 53, homeworkScore: 6, parentEmail: 's.rivera@email.com', parentPhone: '(972) 555-8844',
    paymentMethod: 'Visa ·1190', hittraxAvgExitVelo: 51.0, hittraxBestVelo: 53, hittraxLaunchAngle: 12,
    sparklinePoints: [48, 49, 50, 51, 51, 52, 52, 53, 52, 53],
    timeline: [
      tl('t1', 'booking', 7, 'Cage rental', 'Cage 3 · 60 min', 'completed'),
      tl('t2', 'payment', 8, 'Payment processed', 'Cage Rental Monthly — Auto-pay', 'paid', 120),
      tl('t3', 'booking', 17, 'Cage rental', 'Cage 2 · 60 min', 'completed'),
    ],
    recentPayments: [pmt('p1', 8, 120, 'paid', 'Visa ·1190'), pmt('p2', 38, 120, 'paid', 'Visa ·1190')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d11: {
    id: 'd11', kidId: 'k11', name: 'Owen Murphy', age: '15U', parent: 'Patrick Murphy',
    program: 'Team Training', planType: 'eft', status: 'paused', engagementScore: 30,
    churnRisk: 'high', lastSession: '35d ago', nextCharge: '—', mrr: 0, lifetime: 2250, joinedDate: 'May 2024',
    memberForMonths: 24, bookingCount: 24, hittraxSessionCount: 12, pointsBalance: 190,
    bestVeloMph: 78, homeworkScore: 3, parentEmail: 'p.murphy@email.com', parentPhone: '(817) 555-2211',
    paymentMethod: 'Visa ·7723', hittraxAvgExitVelo: 75.0, hittraxBestVelo: 78, hittraxLaunchAngle: 17,
    sparklinePoints: [74, 75, 76, 77, 78, 77, 76, 75, 74, 73],
    timeline: [
      tl('t1', 'booking', 35, 'Last session before pause', 'Team Training · Coach Alex', 'completed'),
      tl('t2', 'payment', 40, 'Payment refunded', 'Membership paused — partial refund', 'paid', 225),
      tl('t3', 'booking', 42, 'Session completed', 'Team Training · Coach Alex', 'completed'),
    ],
    recentPayments: [pmt('p1', 40, 225, 'refunded', 'Visa ·7723')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d12: {
    id: 'd12', kidId: 'k12', name: 'Liam Perez', age: '11U', parent: 'Ana Perez',
    program: '8-Pack Lessons', planType: 'otc', status: 'active', engagementScore: 82,
    churnRisk: 'low', lastSession: '3d ago', nextCharge: '—', mrr: 0, lifetime: 960, joinedDate: 'Jan 2025',
    memberForMonths: 16, bookingCount: 14, hittraxSessionCount: 5, pointsBalance: 560,
    bestVeloMph: 63, homeworkScore: 8, parentEmail: 'a.perez@email.com', parentPhone: '(469) 555-3390',
    paymentMethod: 'MC ·5567', hittraxAvgExitVelo: 60.8, hittraxBestVelo: 63, hittraxLaunchAngle: 13,
    sparklinePoints: [58, 59, 60, 61, 61, 62, 63, 62, 63, 63],
    timeline: [
      tl('t1', 'booking', 3, 'Session completed', 'Private · Coach Mike · Cage 3', 'completed'),
      tl('t2', 'booking', 10, 'Earned 25 points', 'Completed homework: Contact drills', 'completed'),
      tl('t3', 'payment', 25, 'Payment processed', '8-Pack Lessons — one-time', 'paid', 480),
    ],
    recentPayments: [pmt('p1', 25, 480, 'paid', 'MC ·5567')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d13: {
    id: 'd13', kidId: 'k13', name: 'Zane Harris', age: '14U', parent: 'Terry Harris',
    program: 'Unlimited Monthly', planType: 'eft', status: 'active', engagementScore: 77,
    churnRisk: 'low', lastSession: '6d ago', nextCharge: 'Jun 12', mrr: 280, lifetime: 3360, joinedDate: 'Feb 2024',
    memberForMonths: 27, bookingCount: 30, hittraxSessionCount: 16, pointsBalance: 920,
    bestVeloMph: 72, homeworkScore: 7, parentEmail: 't.harris@email.com', parentPhone: '(214) 555-1133',
    paymentMethod: 'Visa ·8843', hittraxAvgExitVelo: 69.5, hittraxBestVelo: 72, hittraxLaunchAngle: 16,
    sparklinePoints: [65, 67, 68, 69, 70, 71, 71, 72, 71, 72],
    timeline: [
      tl('t1', 'booking', 6, 'Session completed', 'Private · Coach Alex · Cage 2', 'completed'),
      tl('t2', 'payment', 8, 'Payment processed', 'Unlimited Monthly — Auto-pay', 'paid', 280),
      tl('t3', 'booking', 13, 'Session completed', 'Private · Coach Alex', 'completed'),
    ],
    recentPayments: [pmt('p1', 8, 280, 'paid', 'Visa ·8843'), pmt('p2', 38, 280, 'paid', 'Visa ·8843')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d14: {
    id: 'd14', kidId: 'k14', name: 'Carter Simmons', age: '12U', parent: 'Gina Simmons',
    program: '4-Pack Lessons', planType: 'otc', status: 'cancelled', engagementScore: 0,
    churnRisk: 'high', lastSession: '52d ago', nextCharge: '—', mrr: 0, lifetime: 540, joinedDate: 'Oct 2024',
    memberForMonths: 19, bookingCount: 6, hittraxSessionCount: 2, pointsBalance: 50,
    bestVeloMph: 58, homeworkScore: 2, parentEmail: 'g.simmons@email.com', parentPhone: '(817) 555-6610',
    paymentMethod: 'Visa ·4422', hittraxAvgExitVelo: 55.3, hittraxBestVelo: 58, hittraxLaunchAngle: 11,
    sparklinePoints: [54, 55, 56, 57, 58, 57, 56, 55, 54, 52],
    timeline: [
      tl('t1', 'booking', 52, 'Last session', 'Private · Coach Mike', 'completed'),
      tl('t2', 'payment', 55, 'Payment failed', 'Membership renewal — card declined', 'failed', 320),
      tl('t3', 'booking', 60, 'Session completed', 'Private · Coach Mike', 'completed'),
    ],
    recentPayments: [pmt('p1', 55, 320, 'failed', 'Visa ·4422')],
    cancelAt: null,
    billingAnchorDay: null,
  },
  d15: {
    id: 'd15', kidId: 'k15', name: 'Hunter Davis', age: '13U', parent: 'Todd Davis',
    program: 'Cage Rental Monthly', planType: 'eft', status: 'active', engagementScore: 68,
    churnRisk: 'low', lastSession: '9d ago', nextCharge: 'Jun 4', mrr: 120, lifetime: 1320, joinedDate: 'Sep 2024',
    memberForMonths: 20, bookingCount: 20, hittraxSessionCount: 0, pointsBalance: 440,
    bestVeloMph: 64, homeworkScore: 6, parentEmail: 't.davis@email.com', parentPhone: '(972) 555-7766',
    paymentMethod: 'Visa ·3355', hittraxAvgExitVelo: 61.2, hittraxBestVelo: 64, hittraxLaunchAngle: 13,
    sparklinePoints: [58, 59, 60, 61, 62, 63, 63, 64, 63, 64],
    timeline: [
      tl('t1', 'booking', 9, 'Cage rental', 'Cage 1 · 60 min', 'completed'),
      tl('t2', 'payment', 11, 'Payment processed', 'Cage Rental Monthly — Auto-pay', 'paid', 120),
      tl('t3', 'booking', 19, 'Cage rental', 'Cage 3 · 60 min', 'completed'),
    ],
    recentPayments: [pmt('p1', 11, 120, 'paid', 'Visa ·3355'), pmt('p2', 41, 120, 'paid', 'Visa ·3355')],
    cancelAt: null,
    billingAnchorDay: null,
  },
};
