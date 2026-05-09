export const demoData = {
  location: { name: 'Infinite Hitting — North Dallas', members: 287 },
  owner: { name: 'Mike Patterson', role: 'Owner' },
  franchisor: { name: 'Tom Kincaid', role: 'Franchisor' },

  ownerKPIs: {
    mrr: 80360, mrrDelta: 8.2,
    activeMembers: 287, membersDelta: 4.4,
    retentionRate: 89.4, retentionDelta: 1.8,
    atRiskCount: 8, failedPayments: 3,
    todayOccupancy: 78,
  },

  networkKPIs: {
    totalLocations: 17,
    totalMembers: 4892,
    networkMRR: 1387400,
    networkMRRDelta: 6.4,
    avgRetention: 87.1,
    avgChurn: 12.9,
  },

  locations: [
    { id: 1, name: 'Phoenix', owner: 'Jessica Chen', members: 412, mrr: 118400, retention: 92.8, churnRisk: 'low', trend: 14.8 },
    { id: 2, name: 'Austin C.', owner: 'Sarah Kim', members: 342, mrr: 95800, retention: 91.2, churnRisk: 'low', trend: 11.5 },
    { id: 3, name: 'Atlanta', owner: 'Derek Thompson', members: 321, mrr: 88200, retention: 86.5, churnRisk: 'medium', trend: 3.4 },
    { id: 4, name: 'Dallas N.', owner: 'Mike Patterson', members: 287, mrr: 80360, retention: 89.4, churnRisk: 'low', trend: 8.2 },
    { id: 5, name: 'Houston W.', owner: 'Rob Martinez', members: 298, mrr: 78900, retention: 87.8, churnRisk: 'low', trend: 5.2 },
    { id: 6, name: 'Tampa', owner: 'Melissa Grant', members: 289, mrr: 76500, retention: 88.9, churnRisk: 'low', trend: 7.1 },
    { id: 7, name: 'Dallas S.', owner: 'Jennifer Ford', members: 267, mrr: 71800, retention: 88.1, churnRisk: 'low', trend: 6.7 },
    { id: 8, name: 'Orlando', owner: 'Carlos Ruiz', members: 268, mrr: 71200, retention: 86.7, churnRisk: 'low', trend: 5.4 },
    { id: 9, name: 'San Antonio', owner: 'Marcus Williams', members: 245, mrr: 64200, retention: 85.4, churnRisk: 'medium', trend: 2.1 },
    { id: 10, name: 'Charlotte', owner: 'Brian Lee', members: 234, mrr: 62800, retention: 87.3, churnRisk: 'low', trend: 4.8 },
    { id: 11, name: 'Las Vegas', owner: 'Tony Marino', members: 221, mrr: 58700, retention: 85.1, churnRisk: 'medium', trend: 1.9 },
    { id: 12, name: 'Indianapolis', owner: 'Steve Colby', members: 204, mrr: 54200, retention: 86.2, churnRisk: 'low', trend: 4.5 },
    { id: 13, name: 'Columbus', owner: 'Karen Baxter', members: 198, mrr: 51800, retention: 85.8, churnRisk: 'medium', trend: 3.2 },
    { id: 14, name: 'Nashville', owner: 'Amanda Reese', members: 198, mrr: 51400, retention: 84.2, churnRisk: 'medium', trend: -1.2 },
    { id: 15, name: 'Denver', owner: 'Rachel Kim', members: 187, mrr: 48900, retention: 82.5, churnRisk: 'high', trend: -2.8 },
    { id: 16, name: 'St. Louis', owner: 'Greg Hanson', members: 179, mrr: 45800, retention: 83.7, churnRisk: 'medium', trend: 0.8 },
    { id: 17, name: 'Kansas City', owner: 'Paul Simmons', members: 142, mrr: 36200, retention: 79.8, churnRisk: 'high', trend: -4.1 },
  ],

  revenueByPackage: [
    { name: 'Unlimited Monthly', price: 280, activeCount: 147, mrr: 41160, pctRevenue: 51.2, ltv: 3360 },
    { name: '8-Pack Lessons', price: 320, activeCount: 42, mrr: 13440, pctRevenue: 16.7, ltv: 960 },
    { name: '4-Pack Lessons', price: 180, activeCount: 38, mrr: 6840, pctRevenue: 8.5, ltv: 540 },
    { name: 'Team Training', price: 450, activeCount: 12, mrr: 5400, pctRevenue: 6.7, ltv: 5400 },
    { name: 'Cage Rental Monthly', price: 120, activeCount: 31, mrr: 3720, pctRevenue: 4.6, ltv: 1440 },
    { name: 'Camps & Clinics', price: 195, activeCount: 0, mrr: 9800, pctRevenue: 12.3, ltv: 390 },
  ],

  revenueByProgram: [
    { name: 'Private Hitting Lessons', revenue: 48200, pctTotal: 60.0 },
    { name: 'Cage Rental', revenue: 12400, pctTotal: 15.4 },
    { name: 'Group Classes', revenue: 9800, pctTotal: 12.2 },
    { name: 'Team Training', revenue: 5400, pctTotal: 6.7 },
    { name: 'Assessments', revenue: 2800, pctTotal: 3.5 },
    { name: 'Merch & Retail', revenue: 1760, pctTotal: 2.2 },
  ],

  members: [
    { id: 1, name: 'Jake Rodriguez', age: 11, program: 'Unlimited Monthly', parent: 'Sarah Rodriguez', status: 'active', engagementScore: 92, churnRisk: 'low', lastSession: '2d ago', nextCharge: 'Nov 3', mrr: 280, lifetime: 3360, joinedDate: 'Jun 2024' },
    { id: 2, name: 'Mia Chen', age: 9, program: 'Unlimited Monthly', parent: 'David Chen', status: 'active', engagementScore: 87, churnRisk: 'low', lastSession: '1d ago', nextCharge: 'Nov 12', mrr: 280, lifetime: 2520, joinedDate: 'Aug 2024' },
    { id: 3, name: 'Liam Thompson', age: 13, program: '8-Pack', parent: 'Jennifer Thompson', status: 'active', engagementScore: 76, churnRisk: 'low', lastSession: '4d ago', nextCharge: 'Nov 20', mrr: 320, lifetime: 1280, joinedDate: 'Jul 2025' },
    { id: 4, name: 'Emma Foster', age: 10, program: 'Unlimited Monthly', parent: 'Michael Foster', status: 'at-risk', engagementScore: 42, churnRisk: 'high', lastSession: '18d ago', nextCharge: 'Nov 8', mrr: 280, lifetime: 1680, joinedDate: 'Feb 2025', riskReason: 'No session in 18 days, homework engagement dropped 80%' },
    { id: 5, name: 'Noah Patel', age: 12, program: 'Unlimited Monthly', parent: 'Priya Patel', status: 'active', engagementScore: 94, churnRisk: 'low', lastSession: 'Today', nextCharge: 'Nov 15', mrr: 280, lifetime: 4200, joinedDate: 'Jan 2024' },
    { id: 6, name: 'Ava Williams', age: 11, program: '4-Pack', parent: 'Robert Williams', status: 'at-risk', engagementScore: 38, churnRisk: 'high', lastSession: '22d ago', nextCharge: 'Overdue', mrr: 180, lifetime: 540, joinedDate: 'Aug 2025', riskReason: 'Failed payment, no session in 22 days' },
    { id: 7, name: 'Ethan Garcia', age: 14, program: 'Unlimited Monthly', parent: 'Maria Garcia', status: 'active', engagementScore: 89, churnRisk: 'low', lastSession: '3d ago', nextCharge: 'Nov 18', mrr: 280, lifetime: 5040, joinedDate: 'Aug 2023' },
    { id: 8, name: 'Mason Lee', age: 13, program: '8-Pack', parent: 'Daniel Lee', status: 'at-risk', engagementScore: 51, churnRisk: 'medium', lastSession: '11d ago', nextCharge: 'Nov 22', mrr: 320, lifetime: 960, joinedDate: 'Jul 2025', riskReason: 'Engagement dropping, no homework in 14 days' },
    { id: 9, name: 'Sophia Brown', age: 10, program: 'Unlimited Monthly', parent: 'Alex Brown', status: 'active', engagementScore: 85, churnRisk: 'low', lastSession: '1d ago', nextCharge: 'Nov 9', mrr: 280, lifetime: 2240, joinedDate: 'Mar 2025' },
    { id: 10, name: 'Benjamin Nash', age: 13, program: 'Unlimited Monthly', parent: 'Laura Nash', status: 'at-risk', engagementScore: 33, churnRisk: 'high', lastSession: '24d ago', nextCharge: 'Nov 7', mrr: 280, lifetime: 3360, joinedDate: 'Jun 2024', riskReason: 'No session in 24 days, last 3 sessions cancelled' },
    { id: 11, name: 'Isabella Kim', age: 9, program: 'Unlimited Monthly', parent: 'Sandra Kim', status: 'active', engagementScore: 81, churnRisk: 'low', lastSession: '2d ago', nextCharge: 'Nov 6', mrr: 280, lifetime: 1680, joinedDate: 'May 2025' },
    { id: 12, name: 'Lucas Wright', age: 12, program: 'Team Training', parent: 'Jessica Wright', status: 'active', engagementScore: 78, churnRisk: 'low', lastSession: '2d ago', nextCharge: 'Nov 14', mrr: 450, lifetime: 5400, joinedDate: 'Sep 2024' },
  ],

  failedPayments: [
    { id: 1, member: 'Ava Williams', parent: 'Robert Williams', amount: 180, package: '4-Pack Lessons', failedDate: 'Oct 15', reason: 'Card declined', attempts: 3, nextAttempt: 'Oct 22' },
    { id: 2, member: 'Tyler Stone', parent: 'Monica Stone', amount: 280, package: 'Unlimited Monthly', failedDate: 'Oct 17', reason: 'Insufficient funds', attempts: 2, nextAttempt: 'Oct 23' },
    { id: 3, member: 'Zoe Park', parent: 'Kevin Park', amount: 120, package: 'Cage Rental Monthly', failedDate: 'Oct 18', reason: 'Expired card', attempts: 1, nextAttempt: 'Oct 24' },
  ],

  cohortRetention: [
    { cohort: 'Jan 2024', size: 23, retention: [100, 95.6, 91.3, 87.0, 82.6, 78.3, 78.3, 78.3, 73.9, 73.9] },
    { cohort: 'Feb 2024', size: 19, retention: [100, 94.7, 89.5, 84.2, 84.2, 78.9, 78.9, 73.7, 73.7] },
    { cohort: 'Mar 2024', size: 27, retention: [100, 96.3, 92.6, 88.9, 85.2, 81.5, 77.8, 77.8] },
    { cohort: 'Apr 2024', size: 22, retention: [100, 95.5, 90.9, 86.4, 81.8, 81.8, 77.3] },
    { cohort: 'May 2024', size: 31, retention: [100, 96.8, 93.5, 90.3, 87.1, 83.9] },
    { cohort: 'Jun 2024', size: 28, retention: [100, 96.4, 92.9, 89.3, 85.7] },
    { cohort: 'Jul 2024', size: 33, retention: [100, 97.0, 93.9, 90.9] },
    { cohort: 'Aug 2024', size: 29, retention: [100, 96.6, 93.1] },
    { cohort: 'Sep 2024', size: 35, retention: [100, 97.1] },
    { cohort: 'Oct 2024', size: 31, retention: [100] },
  ],

  churnReasons: [
    { reason: 'Schedule conflict / too busy', count: 18, pct: 31.0 },
    { reason: 'Cost concerns', count: 14, pct: 24.1 },
    { reason: 'Kid lost interest', count: 11, pct: 19.0 },
    { reason: 'Moved away', count: 6, pct: 10.3 },
    { reason: 'Switched to competitor', count: 4, pct: 6.9 },
    { reason: 'Injury / health', count: 3, pct: 5.2 },
    { reason: 'Other / unknown', count: 2, pct: 3.4 },
  ],

  pointsRules: [
    { id: 1, action: 'Attend a training session', points: 10, enabled: true },
    { id: 2, action: 'Complete a homework assignment', points: 25, enabled: true },
    { id: 3, action: 'Hit a new personal best (HitTrax)', points: 15, enabled: true },
    { id: 4, action: 'Streak milestone (every 7 days)', points: 30, enabled: true },
    { id: 5, action: 'Top 10 weekly leaderboard', points: 50, enabled: true },
    { id: 6, action: 'Refer a friend', points: 100, enabled: true },
  ],

  rewardsCatalog: [
    { id: 1, name: 'Infinite Hitting Tee', category: 'Apparel', cost: 400, inventory: 24, fulfilled: 18, pending: 3 },
    { id: 2, name: 'Free Training Session', category: 'Sessions', cost: 600, inventory: 'Unlimited', fulfilled: 12, pending: 1 },
    { id: 3, name: 'Custom Training Bat', category: 'Equipment', cost: 1200, inventory: 8, fulfilled: 5, pending: 2 },
    { id: 4, name: 'IH Hoodie — Legacy', category: 'Apparel', cost: 800, inventory: 14, fulfilled: 9, pending: 1 },
    { id: 5, name: 'Batting Gloves', category: 'Equipment', cost: 500, inventory: 18, fulfilled: 11, pending: 2 },
    { id: 6, name: 'Holiday Camp Entry', category: 'Sessions', cost: 1500, inventory: 'Unlimited', fulfilled: 3, pending: 0 },
  ],

  recentTransactions: [
    { date: 'Oct 19 · 2:14 PM', member: 'Jake Rodriguez', package: 'Unlimited Monthly', amount: 280, status: 'paid', method: 'Visa •4242', type: 'EFT' },
    { date: 'Oct 19 · 11:42 AM', member: 'Noah Patel', package: 'Unlimited Monthly', amount: 280, status: 'paid', method: 'MC •7821', type: 'EFT' },
    { date: 'Oct 18 · 6:22 PM', member: 'Sophia Brown', package: 'Holiday Camp', amount: 195, status: 'paid', method: 'Amex •0012', type: 'OTC' },
    { date: 'Oct 18 · 3:45 PM', member: 'Ava Williams', package: '4-Pack Lessons', amount: 180, status: 'failed', method: 'Visa •9918', type: 'OTC' },
    { date: 'Oct 18 · 1:30 PM', member: 'Lucas Wright', package: 'Team Training', amount: 450, status: 'paid', method: 'Visa •5523', type: 'EFT' },
    { date: 'Oct 17 · 4:58 PM', member: 'Tyler Stone', package: 'Unlimited Monthly', amount: 280, status: 'failed', method: 'Visa •7712', type: 'EFT' },
  ],

  forecast: {
    thisMonth: {
      collectedSoFar: 62420,
      remainingToCollect: 18240,
      projectedDeclines: 1020,
      projectedCancellations: 680,
      netProjected: 78960,
      grossProjected: 80660,
    },
    nextMonth: {
      openingMRR: 80360,
      expectedNewSignups: 5600,
      expectedChurn: 1840,
      expectedDeclines: 960,
      projectedGross: 84120,
      projectedNet: 83160,
      confidence: 87,
    },
  },

  eftVsOtc: {
    eft: { label: 'EFT (Recurring)', amount: 57480, pct: 71.5, mom: 6.2, description: 'Auto-pay membership revenue' },
    otc: { label: 'OTC (Upfront Cash)', amount: 22880, pct: 28.5, mom: 14.3, description: 'New signups, packages, camps, drop-ins' },
  },

  eftVsOtcMonthly: [
    { month: 'May', eft: 52400, otc: 21600 },
    { month: 'Jun', eft: 51200, otc: 19800 },
    { month: 'Jul', eft: 53800, otc: 19200 },
    { month: 'Aug', eft: 55200, otc: 20800 },
    { month: 'Sep', eft: 54100, otc: 19900 },
    { month: 'Oct', eft: 57480, otc: 22880 },
  ],

  coaches: [
    { id: 1, name: 'Coach Mike Patterson', students: 48, utilization: 87, retention: 92.1, avgRating: 4.9, revenue: 23800, weeklyHours: 38, specialty: 'Hitting, Youth Development', joinedDate: 'Jun 2022' },
    { id: 2, name: 'Coach Sarah Lin', students: 42, utilization: 82, retention: 90.4, avgRating: 4.8, revenue: 19600, weeklyHours: 35, specialty: 'Hitting, Mental Game', joinedDate: 'Sep 2022' },
    { id: 3, name: 'Coach Derek Ross', students: 51, utilization: 91, retention: 88.7, avgRating: 4.7, revenue: 24200, weeklyHours: 40, specialty: 'Power Hitting, HS Prep', joinedDate: 'Jan 2023' },
    { id: 4, name: 'Coach Jessica Banks', students: 38, utilization: 76, retention: 89.2, avgRating: 4.9, revenue: 17400, weeklyHours: 32, specialty: 'Youth 8U-10U', joinedDate: 'Mar 2023' },
    { id: 5, name: 'Coach Tony Valdez', students: 44, utilization: 84, retention: 87.5, avgRating: 4.6, revenue: 20800, weeklyHours: 36, specialty: 'Team Training, Situational', joinedDate: 'Aug 2023' },
    { id: 6, name: 'Coach Amanda Reyes', students: 32, utilization: 68, retention: 91.3, avgRating: 4.8, revenue: 14200, weeklyHours: 28, specialty: 'Girls Fastpitch', joinedDate: 'Feb 2024' },
  ],

  missingInAction: {
    sevenDay: [
      { id: 101, name: 'Mason Lee', age: 13, lastSession: '8d ago', lastDate: 'Oct 12', program: 'Unlimited Monthly', mrr: 280, totalSessions: 18, tenure: '4 months', coach: 'Sarah Lin', engagementScore: 58 },
      { id: 102, name: 'Charlotte Davis', age: 11, lastSession: '9d ago', lastDate: 'Oct 11', program: 'Cage Rental', mrr: 120, totalSessions: 8, tenure: '7 months', coach: 'Tony Valdez', engagementScore: 65 },
      { id: 103, name: 'Olivia Martinez', age: 10, lastSession: '7d ago', lastDate: 'Oct 13', program: '4-Pack', mrr: 180, totalSessions: 3, tenure: '3 weeks', coach: 'Jessica Banks', engagementScore: 71 },
      { id: 104, name: 'Ryan Foster', age: 12, lastSession: '8d ago', lastDate: 'Oct 12', program: 'Unlimited Monthly', mrr: 280, totalSessions: 42, tenure: '11 months', coach: 'Mike Patterson', engagementScore: 68 },
      { id: 105, name: 'Ethan Kim', age: 9, lastSession: '9d ago', lastDate: 'Oct 11', program: 'Unlimited Monthly', mrr: 280, totalSessions: 12, tenure: '2 months', coach: 'Jessica Banks', engagementScore: 62 },
    ],
    fourteenDay: [
      { id: 106, name: 'Emma Foster', age: 10, lastSession: '18d ago', lastDate: 'Oct 2', program: 'Unlimited Monthly', mrr: 280, totalSessions: 24, tenure: '8 months', coach: 'Mike Patterson', engagementScore: 42 },
      { id: 107, name: 'Tyler Kim', age: 14, lastSession: '16d ago', lastDate: 'Oct 4', program: '8-Pack', mrr: 320, totalSessions: 6, tenure: '3 months', coach: 'Derek Ross', engagementScore: 48 },
      { id: 108, name: 'Grace Walker', age: 11, lastSession: '15d ago', lastDate: 'Oct 5', program: 'Unlimited Monthly', mrr: 280, totalSessions: 28, tenure: '7 months', coach: 'Sarah Lin', engagementScore: 51 },
    ],
    thirtyDay: [
      { id: 109, name: 'Ava Williams', age: 11, lastSession: '22d ago', lastDate: 'Sep 28', program: '4-Pack', mrr: 180, totalSessions: 4, tenure: '2 months', coach: 'Jessica Banks', engagementScore: 38 },
      { id: 110, name: 'Benjamin Nash', age: 13, lastSession: '24d ago', lastDate: 'Sep 26', program: 'Unlimited Monthly', mrr: 280, totalSessions: 35, tenure: '16 months', coach: 'Mike Patterson', engagementScore: 33 },
    ],
  },

  scheduleSlots: [
    { time: 0, cage: 2, name: 'Jake R.', coach: 'Mike', type: 'Private' },
    { time: 1, cage: 2, name: 'Mia C.', coach: 'Mike', type: 'Private' },
    { time: 2, cage: 0, name: 'Noah P.', coach: 'Sarah', type: 'Assessment' },
    { time: 2, cage: 4, name: 'Team Training', coach: 'Tony', type: 'Team' },
    { time: 4, cage: 2, name: 'Liam T.', coach: 'Mike', type: 'Private' },
    { time: 4, cage: 5, name: 'Group Class', coach: 'Derek', type: 'Group' },
    { time: 5, cage: 2, name: 'Isabella K.', coach: 'Mike', type: 'Private' },
    { time: 5, cage: 3, name: 'Ryan F.', coach: 'Sarah', type: 'Private' },
    { time: 6, cage: 2, name: 'Ethan G.', coach: 'Mike', type: 'Private' },
    { time: 6, cage: 3, name: 'Mason L.', coach: 'Sarah', type: 'Private' },
    { time: 6, cage: 4, name: 'Lucas W.', coach: 'Tony', type: 'Private' },
    { time: 7, cage: 2, name: 'Sophia B.', coach: 'Mike', type: 'Private' },
    { time: 7, cage: 4, name: 'Ethan K.', coach: 'Jessica', type: 'Private' },
    { time: 7, cage: 6, name: 'Girls Clinic', coach: 'Amanda', type: 'Group' },
    { time: 8, cage: 2, name: 'Mason L.', coach: 'Mike', type: 'Private' },
    { time: 8, cage: 5, name: 'HS Showcase', coach: 'Derek', type: 'Team' },
  ],
};
