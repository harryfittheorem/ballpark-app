import React, { useState } from 'react';
import {
  LayoutDashboard, Users, Calendar, Package, CreditCard, TrendingDown, TrendingUp,
  UserCog, Gift, Video, Megaphone, Map as MapIcon, Settings, Search, Bell, ChevronDown,
  ChevronRight, ChevronLeft, Plus, Filter, Download, MoreVertical, ArrowUpRight,
  ArrowDownRight, AlertTriangle, AlertCircle, CheckCircle2, XCircle, Clock,
  Sparkles, Star, Target, Award, Zap, Flame, DollarSign, BarChart3,
  FileText, Mail, Phone, MessageCircle, Edit2, Copy, Shield, Activity,
  Dumbbell, ShoppingBag, Send, Building2
} from 'lucide-react';

// ============================================
// BRAND TOKENS
// ============================================
const brand = {
  dark: '#2D2B2A',
  darker: '#1C1B1A',
  darkest: '#0F0E0E',
  gold: '#F1E5AD',
  goldBright: '#E8D89A',
  goldDeep: '#B8A268',
  goldHover: '#D9C88F',
  cream: '#FAF6E8',
  creamLight: '#FDFBF2',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B6560',
  textLight: '#9B9590',
  border: '#E8E3D5',
  borderStrong: '#D4CEBE',
  borderDark: '#3A3836',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0E0',
  success: '#5B8A3A',
  successBg: '#E8F0DC',
  warning: '#C48420',
  warningBg: '#F9EDD5',
  danger: '#B84A3A',
  dangerBg: '#F5DED8',
  info: '#3A6B8A',
  infoBg: '#D8E6EF',
};

const fonts = {
  display: "'Oswald', 'Bebas Neue', Impact, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
};

// ============================================
// DATA
// ============================================
const demoData = {
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

  // Financial forecast — this month + next month
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

  // EFT vs OTC breakdown
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

  // Coach management
  coaches: [
    { id: 1, name: 'Coach Mike Patterson', students: 48, utilization: 87, retention: 92.1, avgRating: 4.9, revenue: 23800, weeklyHours: 38, specialty: 'Hitting, Youth Development', joinedDate: 'Jun 2022' },
    { id: 2, name: 'Coach Sarah Lin', students: 42, utilization: 82, retention: 90.4, avgRating: 4.8, revenue: 19600, weeklyHours: 35, specialty: 'Hitting, Mental Game', joinedDate: 'Sep 2022' },
    { id: 3, name: 'Coach Derek Ross', students: 51, utilization: 91, retention: 88.7, avgRating: 4.7, revenue: 24200, weeklyHours: 40, specialty: 'Power Hitting, HS Prep', joinedDate: 'Jan 2023' },
    { id: 4, name: 'Coach Jessica Banks', students: 38, utilization: 76, retention: 89.2, avgRating: 4.9, revenue: 17400, weeklyHours: 32, specialty: 'Youth 8U-10U', joinedDate: 'Mar 2023' },
    { id: 5, name: 'Coach Tony Valdez', students: 44, utilization: 84, retention: 87.5, avgRating: 4.6, revenue: 20800, weeklyHours: 36, specialty: 'Team Training, Situational', joinedDate: 'Aug 2023' },
    { id: 6, name: 'Coach Amanda Reyes', students: 32, utilization: 68, retention: 91.3, avgRating: 4.8, revenue: 14200, weeklyHours: 28, specialty: 'Girls Fastpitch', joinedDate: 'Feb 2024' },
  ],

  // Missing in Action (MIA) report — attendance-based churn risk
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

  // Scheduling — today's bookings across 8 cages
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

// ============================================
// SHARED COMPONENTS
// ============================================

const KPICard = ({ label, value, unit, delta, deltaLabel, icon: Icon, color = 'default' }) => {
  const colors = {
    default: { bg: brand.surface, border: brand.border, iconBg: `${brand.goldDeep}22`, iconColor: brand.goldDeep },
    gold: { bg: `${brand.gold}15`, border: brand.goldDeep, iconBg: brand.gold, iconColor: brand.dark },
    danger: { bg: brand.dangerBg, border: brand.danger, iconBg: `${brand.danger}22`, iconColor: brand.danger },
    success: { bg: brand.successBg, border: brand.success, iconBg: `${brand.success}22`, iconColor: brand.success },
    warning: { bg: brand.warningBg, border: brand.warning, iconBg: `${brand.warning}22`, iconColor: brand.warning },
  };
  const c = colors[color];
  const isPositive = delta >= 0;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display }}>{label}</div>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={c.iconColor} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: brand.textMuted, fontWeight: 600 }}>{unit}</div>}
      </div>
      {delta !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: isPositive ? brand.success : brand.danger }}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {isPositive ? '+' : ''}{delta}%
          <span style={{ color: brand.textMuted, fontWeight: 500, marginLeft: 4 }}>{deltaLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
};

const Chip = ({ children, color = 'default', size = 'md' }) => {
  const colors = {
    default: { bg: brand.surfaceAlt, text: brand.textMuted, border: brand.border },
    success: { bg: brand.successBg, text: brand.success, border: 'transparent' },
    warning: { bg: brand.warningBg, text: brand.warning, border: 'transparent' },
    danger: { bg: brand.dangerBg, text: brand.danger, border: 'transparent' },
    info: { bg: brand.infoBg, text: brand.info, border: 'transparent' },
    gold: { bg: `${brand.gold}44`, text: brand.goldDeep, border: 'transparent' },
  };
  const c = colors[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '2px 7px' : '3px 10px',
      background: c.bg, color: c.text,
      borderRadius: 20, fontSize: size === 'sm' ? 10 : 11, fontWeight: 700,
      border: `1px solid ${c.border}`, letterSpacing: 0.3,
      textTransform: 'uppercase', fontFamily: fonts.display,
    }}>{children}</span>
  );
};

const Button = ({ children, variant = 'primary', size = 'md', icon: Icon, onClick, style: extraStyle = {} }) => {
  const variants = {
    primary: { bg: brand.dark, color: brand.gold, border: brand.dark },
    gold: { bg: brand.gold, color: brand.dark, border: brand.gold },
    secondary: { bg: brand.white, color: brand.text, border: brand.borderStrong },
    ghost: { bg: 'transparent', color: brand.textMuted, border: 'transparent' },
  };
  const v = variants[variant];
  const sizes = {
    sm: { padding: '6px 12px', fontSize: 11 },
    md: { padding: '9px 16px', fontSize: 13 },
  };
  const s = sizes[size];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: s.padding, fontSize: s.fontSize,
      background: v.bg, color: v.color,
      border: `1px solid ${v.border}`, borderRadius: 8,
      fontWeight: 700, cursor: 'pointer',
      fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
      ...extraStyle,
    }}>
      {Icon && <Icon size={s.fontSize + 2} strokeWidth={2.5} />}
      {children}
    </button>
  );
};

const PageHeader = ({ title, subtitle, actions, breadcrumb }) => (
  <div style={{ padding: '24px 32px 20px', borderBottom: `1px solid ${brand.border}`, background: brand.surface }}>
    {breadcrumb && (
      <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>{breadcrumb}</div>
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, color: brand.text, margin: 0 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: brand.textMuted, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  </div>
);

const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

const Card = ({ children, padding = 20, style = {} }) => (
  <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding, ...style }}>
    {children}
  </div>
);

const Table = ({ columns, rows, onRowClick }) => (
  <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
          {columns.map((col, i) => (
            <th key={i} style={{ padding: '12px 16px', textAlign: col.align || 'left', fontSize: 10, fontWeight: 800, color: brand.textMuted, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap' }}>
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} onClick={() => onRowClick && onRowClick(row)}
              style={{ borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none', cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = brand.surfaceAlt; }}
              onMouseLeave={(e) => { if (onRowClick) e.currentTarget.style.background = 'transparent'; }}>
            {columns.map((col, j) => (
              <td key={j} style={{ padding: '14px 16px', fontSize: 13, color: brand.text, textAlign: col.align || 'left', verticalAlign: 'middle' }}>
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MiniLineChart = ({ data, color = brand.goldDeep, height = 60, fill = true }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({ x: (i / (data.length - 1)) * 100, y: 100 - ((v - min) / range) * 100 }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fillD = fill ? `${pathD} L100,100 L0,100 Z` : '';
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height }}>
      {fill && <path d={fillD} fill={`${color}22`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const BarChart = ({ data, color = brand.goldDeep, height = 160 }) => {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingBottom: 20, position: 'relative' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>{d.value}</div>
          <div style={{ width: '100%', height: `${(d.value / max) * 100}%`, background: d.highlight ? brand.gold : color, borderRadius: '4px 4px 0 0', minHeight: 2 }} />
          <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0, transform: `translateY(14px)` }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
};

const DonutChart = ({ data, size = 140 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={brand.border} strokeWidth={10} />
      {data.map((d, i) => {
        const pct = d.value / total;
        const strokeDasharray = `${pct * circumference} ${circumference}`;
        const strokeDashoffset = -cumulative * circumference;
        cumulative += pct;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={d.color} strokeWidth={10}
            strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
      })}
    </svg>
  );
};

// ============================================
// SIDEBAR
// ============================================
const Sidebar = ({ currentScreen, navigate, role, collapsed, toggleCollapse }) => {
  const width = collapsed ? 68 : 220;

  const navSections = {
    owner: [
      { label: 'Operations', items: [
        { id: 'owner-dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'members-list', label: 'Members CRM', icon: Users },
        { id: 'scheduling', label: 'Schedule', icon: Calendar },
        { id: 'coach-management', label: 'Coaches', icon: UserCog },
      ] },
      { label: 'Revenue', items: [
        { id: 'billing-dashboard', label: 'Billing', icon: CreditCard },
        { id: 'failed-payments', label: 'Failed Payments', icon: AlertCircle, badge: 3 },
        { id: 'revenue-reports', label: 'Revenue Reports', icon: BarChart3 },
      ] },
      { label: 'Retention', items: [
        { id: 'retention-dashboard', label: 'Retention', icon: TrendingUp },
        { id: 'missing-in-action', label: 'Missing in Action', icon: Clock, badge: 10 },
        { id: 'at-risk', label: 'At-Risk', icon: AlertTriangle, badge: 8 },
        { id: 'churn-analysis', label: 'Churn Analysis', icon: TrendingDown },
      ] },
      { label: 'Config', items: [
        { id: 'points-rules', label: 'Points & Rewards', icon: Sparkles },
      ] },
    ],
    franchisor: [
      { label: 'Network', items: [
        { id: 'franchisor-dashboard', label: 'Overview', icon: LayoutDashboard },
        { id: 'location-detail', label: 'Location Detail', icon: Building2 },
      ] },
      { label: 'Analytics', items: [
        { id: 'retention-dashboard', label: 'Retention', icon: TrendingUp },
        { id: 'churn-analysis', label: 'Churn Analysis', icon: TrendingDown },
      ] },
    ],
  };

  const sections = navSections[role] || navSections.owner;

  return (
    <div style={{
      width, minWidth: width, height: '100%',
      background: brand.dark, color: brand.cream,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${brand.darker}`,
      transition: 'width 0.2s',
    }}>
      <div style={{ padding: collapsed ? '16px 12px' : '20px 16px', borderBottom: `1px solid ${brand.borderDark}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Dumbbell size={18} color={brand.dark} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 1.5, fontFamily: fonts.display, whiteSpace: 'nowrap' }}>INFINITE HITTING</div>
            <div style={{ fontSize: 9, color: brand.textLight, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Operations Portal</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            {section.label && !collapsed && (
              <div style={{ fontSize: 9, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, padding: '0 20px 6px', textTransform: 'uppercase', fontFamily: fonts.display }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const active = currentScreen === item.id;
              return (
                <div key={item.id} onClick={() => navigate(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 22px' : '9px 20px',
                  cursor: 'pointer',
                  background: active ? `${brand.gold}15` : 'transparent',
                  color: active ? brand.gold : brand.cream,
                  borderLeft: active ? `3px solid ${brand.gold}` : '3px solid transparent',
                }}>
                  <item.icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: 'nowrap' }}>{item.label}</div>
                      {item.badge && (
                        <div style={{ fontSize: 9, fontWeight: 800, background: brand.danger, color: brand.white, padding: '2px 6px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>
                          {item.badge}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div onClick={toggleCollapse} style={{ padding: 12, borderTop: `1px solid ${brand.borderDark}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: brand.textLight }}>
        {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /> <span>Collapse</span></>}
      </div>
    </div>
  );
};

// ============================================
// TOP BAR
// ============================================
const TopBar = ({ role, setRole, user, location }) => (
  <div style={{
    height: 60, background: brand.surface, borderBottom: `1px solid ${brand.border}`,
    display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
  }}>
    <div style={{ flex: 1, maxWidth: 480, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}` }}>
      <Search size={14} color={brand.textMuted} />
      <div style={{ flex: 1, fontSize: 13, color: brand.textMuted }}>Search members, payments, sessions...</div>
      <div style={{ fontSize: 10, color: brand.textMuted, background: brand.white, padding: '2px 6px', borderRadius: 4, fontFamily: fonts.mono, fontWeight: 600 }}>⌘K</div>
    </div>

    <div style={{ flex: 1 }} />

    <div style={{ display: 'flex', gap: 4, background: brand.surfaceAlt, padding: 3, borderRadius: 8, border: `1px solid ${brand.border}` }}>
      {[
        { id: 'owner', label: 'Owner' },
        { id: 'franchisor', label: 'Franchisor' },
      ].map(r => (
        <div key={r.id} onClick={() => setRole(r.id)} style={{
          padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
          background: role === r.id ? brand.dark : 'transparent',
          color: role === r.id ? brand.gold : brand.textMuted,
          borderRadius: 5, fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>{r.label}</div>
      ))}
    </div>

    <div style={{ position: 'relative', cursor: 'pointer', padding: 6 }}>
      <Bell size={18} color={brand.textMuted} />
      <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, background: brand.danger }} />
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', paddingLeft: 12, borderLeft: `1px solid ${brand.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: fonts.display }}>
        {user.name.charAt(0)}
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: brand.text }}>{user.name}</div>
        <div style={{ fontSize: 10, color: brand.textMuted }}>{role === 'franchisor' ? 'All 17 Locations' : location.name}</div>
      </div>
      <ChevronDown size={14} color={brand.textMuted} />
    </div>
  </div>
);

// ============================================
// 1. OWNER DASHBOARD
// ============================================
const OwnerDashboard = ({ navigate }) => {
  const k = demoData.ownerKPIs;
  return (
    <div>
      <PageHeader
        title={`Welcome back, ${demoData.owner.name.split(' ')[0]}`}
        subtitle={`${demoData.location.name} · ${demoData.location.members} active members`}
        actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={Plus}>New Member</Button></>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${(k.mrr/1000).toFixed(1)}K`} delta={k.mrrDelta} icon={DollarSign} color="gold" />
          <KPICard label="Active Members" value={k.activeMembers} delta={k.membersDelta} icon={Users} />
          <KPICard label="Retention Rate" value={`${k.retentionRate}%`} delta={k.retentionDelta} icon={TrendingUp} color="success" />
          <KPICard label="At Risk" value={k.atRiskCount} icon={AlertTriangle} color="warning" />
          <KPICard label="Failed Payments" value={k.failedPayments} icon={AlertCircle} color="danger" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Revenue — Last 12 Months" action={<Button variant="ghost" size="sm">Compare</Button>} />
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>$80,360</div>
                  <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>↑ 8.2% vs September</div>
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>October 2025</div>
              </div>
              <BarChart data={[
                { label: 'Nov', value: 62 }, { label: 'Dec', value: 64 }, { label: 'Jan', value: 68 },
                { label: 'Feb', value: 71 }, { label: 'Mar', value: 69 }, { label: 'Apr', value: 72 },
                { label: 'May', value: 74 }, { label: 'Jun', value: 71 }, { label: 'Jul', value: 73 },
                { label: 'Aug', value: 76 }, { label: 'Sep', value: 74 }, { label: 'Oct', value: 80, highlight: true },
              ]} height={180} />
            </Card>

            {/* Financial Forecast */}
            <div style={{ marginTop: 24 }}>
              <SectionHeader title="Financial Forecast" subtitle="Projected auto-collect minus cancellations & declines" action={<Button variant="ghost" size="sm" onClick={() => navigate('billing-dashboard')}>Full Breakdown →</Button>} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* This month */}
                <Card style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>THIS MONTH · PROJECTED</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>${(demoData.forecast.thisMonth.netProjected/1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Net after declines & cancellations</div>
                    </div>
                    <Chip color="success">OCT</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Collected so far</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.success }}>${demoData.forecast.thisMonth.collectedSoFar.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Remaining to collect</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono }}>${demoData.forecast.thisMonth.remainingToCollect.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Expected declines</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${demoData.forecast.thisMonth.projectedDeclines.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Expected cancellations</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${demoData.forecast.thisMonth.projectedCancellations.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.success }}>${demoData.forecast.thisMonth.netProjected.toLocaleString()}</span>
                    </div>
                  </div>
                </Card>

                {/* Next month */}
                <Card style={{ background: `linear-gradient(135deg, ${brand.infoBg} 0%, ${brand.white} 100%)`, borderColor: brand.info }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, color: brand.info, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>NEXT MONTH · FORECAST</div>
                      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, marginTop: 6, letterSpacing: -0.5 }}>${(demoData.forecast.nextMonth.projectedNet/1000).toFixed(1)}K</div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.forecast.nextMonth.confidence}% confidence</div>
                    </div>
                    <Chip color="info">NOV</Chip>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: brand.surface, borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Opening MRR</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono }}>${demoData.forecast.nextMonth.openingMRR.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Expected new signups</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.success }}>+${demoData.forecast.nextMonth.expectedNewSignups.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Expected churn</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${demoData.forecast.nextMonth.expectedChurn.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: brand.textMuted }}>Expected declines</span>
                      <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${demoData.forecast.nextMonth.expectedDeclines.toLocaleString()}</span>
                    </div>
                    <div style={{ borderTop: `1px solid ${brand.border}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ fontWeight: 700 }}>Net projected</span>
                      <span style={{ fontWeight: 800, fontFamily: fonts.mono, color: brand.info }}>${demoData.forecast.nextMonth.projectedNet.toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SectionHeader title="Revenue by Program" action={<Button variant="ghost" size="sm" onClick={() => navigate('revenue-reports')}>Full Report →</Button>} />
              <Card>
                <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DonutChart data={demoData.revenueByProgram.map((p, i) => ({
                      value: p.revenue,
                      color: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i]
                    }))} size={160} />
                    <div style={{ position: 'absolute', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: brand.textMuted, letterSpacing: 1, fontWeight: 700 }}>TOTAL</div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display }}>$80.4K</div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {demoData.revenueByProgram.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < demoData.revenueByProgram.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i] }} />
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>${(p.revenue/1000).toFixed(1)}K</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, width: 48, textAlign: 'right' }}>{p.pctTotal}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div>
            <div onClick={() => navigate('at-risk')} style={{ cursor: 'pointer', marginBottom: 20 }}>
              <SectionHeader title="At-Risk Members" action={<div style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700 }}>View All →</div>} />
              <Card style={{ background: `linear-gradient(135deg, ${brand.dangerBg} 0%, ${brand.warningBg} 100%)`, borderColor: brand.warning }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.danger, color: brand.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={22} strokeWidth={2} />
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display }}>8 members at risk</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>$2,240 monthly revenue at risk</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {demoData.members.filter(m => m.churnRisk === 'high').slice(0, 3).map(m => (
                    <div key={m.id} style={{ padding: 8, background: brand.surface, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {m.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 700 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: brand.danger, fontWeight: 700 }}>{m.lastSession}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <SectionHeader title="Today at a Glance" />
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { icon: Calendar, color: brand.goldDeep, label: 'Sessions', value: '42', meta: '78% utilization', metaColor: brand.success },
                  { icon: CheckCircle2, color: brand.success, label: 'Paid today', value: '$1,840', meta: '7 charges', metaColor: brand.success },
                  { icon: Users, color: brand.info, label: 'New signups MTD', value: '18', meta: '+6 vs last', metaColor: brand.success },
                  { icon: XCircle, color: brand.danger, label: 'Churned MTD', value: '6', meta: '-$1,680 MRR', metaColor: brand.danger },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${row.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <row.icon size={16} color={row.color} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{row.value}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: row.metaColor, fontWeight: 700 }}>{row.meta}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 2. MEMBERS LIST
// ============================================
const MembersList = ({ navigate }) => {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? demoData.members :
    filter === 'at-risk' ? demoData.members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium') :
    filter === 'active' ? demoData.members.filter(m => m.status === 'active') :
    demoData.members;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${demoData.members.length} total · ${demoData.members.filter(m => m.status === 'active').length} active · ${demoData.members.filter(m => m.churnRisk === 'high').length} at high risk`}
        actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={Plus}>Add Member</Button></>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Members', count: demoData.members.length },
            { id: 'active', label: 'Active', count: demoData.members.filter(m => m.status === 'active').length },
            { id: 'at-risk', label: 'At Risk', count: demoData.members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium').length },
          ].map(f => (
            <div key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: filter === f.id ? brand.dark : brand.surface,
              color: filter === f.id ? brand.gold : brand.textMuted,
              border: `1px solid ${filter === f.id ? brand.dark : brand.border}`,
              cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.count}</span>
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <Button variant="secondary" size="sm" icon={Filter}>More Filters</Button>
        </div>

        <Table
          columns={[
            { label: 'Member', key: 'name', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{r.name.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age}U · {r.parent}</div>
                </div>
              </div>
            )},
            { label: 'Program', key: 'program', render: (r) => <div><div style={{ fontSize: 12, fontWeight: 600 }}>{r.program}</div><div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr}/mo</div></div> },
            { label: 'Status', key: 'status', render: (r) => (
              <Chip color={r.status === 'active' ? 'success' : r.status === 'at-risk' ? 'danger' : 'info'}>{r.status}</Chip>
            )},
            { label: 'Engagement', key: 'engagementScore', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 60, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${r.engagementScore}%`, height: '100%', background: r.engagementScore >= 70 ? brand.success : r.engagementScore >= 50 ? brand.warning : brand.danger }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.engagementScore}</div>
              </div>
            )},
            { label: 'Risk', key: 'churnRisk', render: (r) => (
              <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">{r.churnRisk}</Chip>
            )},
            { label: 'Last Session', key: 'lastSession', render: (r) => {
              const isOld = r.lastSession.includes('d ago') && parseInt(r.lastSession) > 14;
              return <span style={{ fontSize: 11, color: isOld ? brand.danger : brand.textMuted, fontWeight: 600 }}>{r.lastSession}</span>;
            }},
            { label: 'LTV', key: 'lifetime', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${r.lifetime.toLocaleString()}</span> },
            { label: 'Next Charge', key: 'nextCharge', render: (r) => (
              <span style={{ fontSize: 11, color: r.nextCharge === 'Overdue' ? brand.danger : brand.textMuted, fontWeight: 600 }}>{r.nextCharge}</span>
            )},
          ]}
          rows={filtered}
          onRowClick={() => navigate('member-detail')}
        />
      </div>
    </div>
  );
};

// ============================================
// 3. MEMBER DETAIL
// ============================================
const MemberDetail = ({ navigate }) => {
  const m = demoData.members[0];
  return (
    <div>
      <PageHeader
        breadcrumb="Members → Jake Rodriguez"
        title={m.name}
        subtitle={`${m.age}U · ${m.program} · Member for 16 months · 27 total sessions · LTV $${m.lifetime.toLocaleString()}`}
        actions={<><Button variant="secondary" icon={MessageCircle}>Message</Button><Button variant="secondary" icon={Edit2}>Edit</Button><Button variant="gold" icon={Calendar}>Book Session</Button></>}
      />

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            <KPICard label="Sessions Done" value="27" deltaLabel="lifetime" icon={Calendar} color="gold" />
            <KPICard label="Member For" value="16" unit="mo" deltaLabel={`since ${m.joinedDate}`} icon={Clock} />
            <KPICard label="Engagement" value={m.engagementScore} unit="/100" color="success" icon={Activity} />
            <KPICard label="Best Velo" value="68" unit="mph" color="gold" icon={Zap} />
            <KPICard label="Homework" value="8/10" icon={Target} color="success" />
          </div>

          <SectionHeader title="HitTrax Performance" action={<Button variant="ghost" size="sm">View All Swings</Button>} />
          <Card>
            <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>AVG EXIT VELO</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4 }}>65.2 mph</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>↑ +4 mph this quarter</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>BEST</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4, color: brand.goldDeep }}>68 mph</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Oct 18, 2025</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>LAUNCH ANGLE</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4 }}>13°</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>Optimal range</div>
              </div>
            </div>
            <MiniLineChart data={[58, 61, 59, 63, 65, 64, 66, 68]} height={100} color={brand.goldDeep} />
          </Card>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Activity Timeline" />
            <Card padding={0}>
              {[
                { time: 'Today, 5:00 PM', icon: Calendar, title: 'Session scheduled', detail: 'Hitting with Coach Mike · Cage 3', color: brand.info },
                { time: 'Yesterday', icon: Sparkles, title: 'Earned 25 points', detail: 'Completed homework: Tee drills', color: brand.goldDeep },
                { time: 'Oct 18', icon: Zap, title: 'New personal best', detail: 'Exit velo: 68 mph (was 66)', color: brand.success },
                { time: 'Oct 18', icon: Calendar, title: 'Session completed', detail: '28 swings tracked via HitTrax', color: brand.info },
                { time: 'Oct 15', icon: CreditCard, title: 'Payment processed', detail: '$280 monthly charge · Visa 4242', color: brand.textMuted },
                { time: 'Oct 14', icon: Flame, title: 'Streak milestone', detail: '14 days active (+30 points)', color: brand.warning },
              ].map((e, i, arr) => (
                <div key={i} style={{ padding: '14px 18px', display: 'flex', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: `${e.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <e.icon size={14} color={e.color} strokeWidth={2.5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: brand.textMuted }}>{e.time}</div>
                    </div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{e.detail}</div>
                  </div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        <div>
          <SectionHeader title="Contact" />
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Parent</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{m.parent}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Email</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>sarah.r@email.com</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Phone</div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>(214) 555-8123</div>
              </div>
            </div>
          </Card>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Billing" />
            <Card>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontFamily: fonts.display }}>UNLIMITED MONTHLY</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>$280<span style={{ fontSize: 12, color: brand.textMuted }}>/mo</span></div>
              <div style={{ marginTop: 14, padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Next charge</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>Nov 3, 2025</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Method</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>Visa •4242</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Auto-pay</div>
                  <Chip color="success" size="sm">ON</Chip>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 4. BILLING DASHBOARD
// ============================================
const BillingDashboard = ({ navigate }) => (
  <div>
    <PageHeader
      title="Billing Overview"
      subtitle="Revenue, auto-collect health, and payment status"
      actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={FileText}>Generate Statement</Button></>}
    />

    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="MRR" value="$80,360" delta={8.2} icon={DollarSign} color="gold" />
        <KPICard label="Collected (MTD)" value="$62,420" delta={5.1} icon={CheckCircle2} color="success" />
        <KPICard label="Auto-Pay Rate" value="94.3%" delta={0.6} icon={Activity} color="success" />
        <KPICard label="Past Due" value="$1,020" delta={-12.8} icon={AlertCircle} color="danger" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div>
          <SectionHeader title="Revenue by Package" subtitle="Monthly recurring revenue breakdown" />
          <Card>
            {demoData.revenueByPackage.map((p, i) => (
              <div key={i} style={{ padding: '12px 0', borderBottom: i < demoData.revenueByPackage.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{p.activeCount} active · ${p.price}/mo · LTV ${p.ltv.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>${(p.mrr/1000).toFixed(1)}K</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 600 }}>{p.pctRevenue}%</div>
                  </div>
                </div>
                <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${p.pctRevenue}%`, height: '100%', background: brand.goldDeep }} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        <div>
          <SectionHeader title="Auto-Collect Health" />
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart data={[
                  { value: 269, color: brand.success },
                  { value: 15, color: brand.warning },
                  { value: 3, color: brand.danger },
                ]} size={120} />
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, color: brand.success }}>94.3%</div>
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>SUCCESS</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: brand.success }} />
                  <div style={{ fontSize: 12, flex: 1 }}>Charged</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>269</div>
                </div>
                <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: brand.warning }} />
                  <div style={{ fontSize: 12, flex: 1 }}>Retry pending</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>15</div>
                </div>
                <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: brand.danger }} />
                  <div style={{ fontSize: 12, flex: 1 }}>Failed</div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.mono }}>3</div>
                </div>
              </div>
            </div>
            <Button variant="secondary" size="sm" icon={AlertCircle} onClick={() => navigate('failed-payments')} style={{ width: '100%', justifyContent: 'center' }}>
              Review 3 Failed Payments →
            </Button>
          </Card>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Projected This Month" subtitle="October forecast" />
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display }}>${demoData.forecast.thisMonth.netProjected.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Net projected total</div>
                </div>
                <Chip color="success">ON TRACK</Chip>
              </div>
              <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Collected so far</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.success }}>${demoData.forecast.thisMonth.collectedSoFar.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Remaining to collect</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono }}>${demoData.forecast.thisMonth.remainingToCollect.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Declines & cancellations</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${(demoData.forecast.thisMonth.projectedDeclines + demoData.forecast.thisMonth.projectedCancellations).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Projected Next Month" subtitle="November forecast" />
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display, color: brand.info }}>${demoData.forecast.nextMonth.projectedNet.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Net forecast · {demoData.forecast.nextMonth.confidence}% confidence</div>
                </div>
                <Chip color="info">FORECAST</Chip>
              </div>
              <div style={{ padding: 12, background: brand.surfaceAlt, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Opening MRR</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono }}>${demoData.forecast.nextMonth.openingMRR.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Expected new signups</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.success }}>+${demoData.forecast.nextMonth.expectedNewSignups.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0' }}>
                  <span style={{ color: brand.textMuted }}>Expected churn + declines</span>
                  <span style={{ fontWeight: 700, fontFamily: fonts.mono, color: brand.danger }}>−${(demoData.forecast.nextMonth.expectedChurn + demoData.forecast.nextMonth.expectedDeclines).toLocaleString()}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Recent Transactions" action={<Button variant="ghost" size="sm">View All →</Button>} />
        <Table
          columns={[
            { label: 'Date', key: 'date' },
            { label: 'Member', key: 'member', render: (r) => <span style={{ fontWeight: 700 }}>{r.member}</span> },
            { label: 'Package', key: 'package' },
            { label: 'Amount', key: 'amount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${r.amount}</span> },
            { label: 'Method', key: 'method' },
            { label: 'Status', key: 'status', render: (r) => <Chip color={r.status === 'paid' ? 'success' : 'danger'}>{r.status}</Chip> },
          ]}
          rows={demoData.recentTransactions}
        />
      </div>
    </div>
  </div>
);

// ============================================
// 5. FAILED PAYMENTS
// ============================================
const FailedPayments = () => (
  <div>
    <PageHeader
      title="Failed Payments"
      subtitle="Resolve these to recover revenue"
      actions={<Button variant="gold" icon={Send}>Email All Parents</Button>}
    />

    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="Revenue at Risk" value="$580" icon={AlertCircle} color="danger" />
        <KPICard label="Accounts Affected" value="3" icon={Users} color="warning" />
        <KPICard label="Avg Recovery Rate" value="72%" deltaLabel="historical" icon={TrendingUp} color="success" />
      </div>

      <SectionHeader title="Action Required" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {demoData.failedPayments.map(f => (
          <Card key={f.id}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.dangerBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={20} color={brand.danger} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{f.member}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Parent: {f.parent}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.danger }}>${f.amount}</div>
                    <div style={{ fontSize: 10, color: brand.textMuted }}>{f.package}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: brand.textMuted, marginBottom: 12 }}>
                  <div>Failed: <strong style={{ color: brand.text }}>{f.failedDate}</strong></div>
                  <div>Reason: <strong style={{ color: brand.text }}>{f.reason}</strong></div>
                  <div>Attempts: <strong style={{ color: brand.text }}>{f.attempts}</strong></div>
                  <div>Next retry: <strong style={{ color: brand.text }}>{f.nextAttempt}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="gold" size="sm" icon={CreditCard}>Retry Charge</Button>
                  <Button variant="secondary" size="sm" icon={Mail}>Email Parent</Button>
                  <Button variant="secondary" size="sm" icon={Phone}>Call</Button>
                  <Button variant="ghost" size="sm" icon={MessageCircle}>Message</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// 6. REVENUE REPORTS
// ============================================
const RevenueReports = () => (
  <div>
    <PageHeader
      title="Revenue Reports"
      subtitle="Deep dive into revenue by program, package, and time period"
      actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={FileText}>Schedule</Button></>}
    />

    <div style={{ padding: 24 }}>
      {/* EFT vs OTC — the recurring vs upfront cash split */}
      <SectionHeader title="EFT vs OTC" subtitle="Recurring membership revenue vs upfront cash (new business, camps, drop-ins)" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* EFT card */}
          <Card style={{ background: `linear-gradient(135deg, ${brand.successBg} 0%, ${brand.white} 100%)`, borderColor: brand.success }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.success, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>EFT · RECURRING</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.eftVsOtc.eft.description}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.success}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={18} color={brand.success} />
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${(demoData.eftVsOtc.eft.amount/1000).toFixed(1)}K</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12, color: brand.success, fontWeight: 700 }}>↑ {demoData.eftVsOtc.eft.mom}% MoM</div>
              <div style={{ fontSize: 11, color: brand.textMuted }}>·</div>
              <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{demoData.eftVsOtc.eft.pct}% of total</div>
            </div>
            <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
              The healthy foundation — predictable recurring revenue. 190 active EFT members.
            </div>
          </Card>

          {/* OTC card */}
          <Card style={{ background: `linear-gradient(135deg, ${brand.warningBg} 0%, ${brand.white} 100%)`, borderColor: brand.warning }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.warning, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display }}>OTC · UPFRONT CASH</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{demoData.eftVsOtc.otc.description}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.warning}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color={brand.warning} />
              </div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1 }}>${(demoData.eftVsOtc.otc.amount/1000).toFixed(1)}K</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <div style={{ fontSize: 12, color: brand.success, fontWeight: 700 }}>↑ {demoData.eftVsOtc.otc.mom}% MoM</div>
              <div style={{ fontSize: 11, color: brand.textMuted }}>·</div>
              <div style={{ fontSize: 12, color: brand.textMuted, fontWeight: 600 }}>{demoData.eftVsOtc.otc.pct}% of total</div>
            </div>
            <div style={{ marginTop: 14, padding: 10, background: brand.surface, borderRadius: 6, fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
              New business, packages, camps, and drop-ins. 87 OTC transactions this month.
            </div>
          </Card>
        </div>

        {/* EFT vs OTC trend */}
        <Card>
          <SectionHeader title="6-Month Trend" />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 20, position: 'relative' }}>
            {demoData.eftVsOtcMonthly.map((m, i) => {
              const total = m.eft + m.otc;
              const max = 82000;
              const heightTotal = (total / max) * 100;
              const eftHeight = (m.eft / max) * 100;
              const isLast = i === demoData.eftVsOtcMonthly.length - 1;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>${Math.round(total/1000)}K</div>
                  <div style={{ width: '100%', height: `${heightTotal}%`, position: 'relative', borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse', minHeight: 2, opacity: isLast ? 1 : 0.85 }}>
                    <div style={{ height: `${(eftHeight / heightTotal) * 100}%`, background: brand.success, minHeight: 2 }} />
                    <div style={{ flex: 1, background: brand.warning, minHeight: 2 }} />
                  </div>
                  <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0, transform: `translateY(14px)` }}>{m.month}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 24, fontSize: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: brand.success }} />
              <span style={{ fontWeight: 600 }}>EFT</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: brand.warning }} />
              <span style={{ fontWeight: 600 }}>OTC</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <SectionHeader title="Revenue by Program" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative' }}>
              <DonutChart data={demoData.revenueByProgram.map((p, i) => ({
                value: p.revenue,
                color: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i]
              }))} size={160} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display }}>$80.4K</div>
                <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>OCTOBER</div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {demoData.revenueByProgram.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', fontSize: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: [brand.goldDeep, brand.gold, brand.info, brand.success, brand.warning, brand.textMuted][i] }} />
                  <div style={{ flex: 1 }}>{p.name}</div>
                  <div style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(p.revenue/1000).toFixed(1)}K</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Package Performance — LTV" />
          {demoData.revenueByPackage.sort((a, b) => b.ltv - a.ltv).map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < demoData.revenueByPackage.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{p.name}</div>
              <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(p.ltv / 5400) * 100}%`, height: '100%', background: brand.goldDeep }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono, width: 62, textAlign: 'right' }}>${p.ltv.toLocaleString()}</div>
            </div>
          ))}
        </Card>
      </div>

      <SectionHeader title="12-Month Revenue Trend" />
      <Card>
        <BarChart data={[
          { label: 'Nov', value: 62 }, { label: 'Dec', value: 64 }, { label: 'Jan', value: 68 },
          { label: 'Feb', value: 71 }, { label: 'Mar', value: 69 }, { label: 'Apr', value: 72 },
          { label: 'May', value: 74 }, { label: 'Jun', value: 71 }, { label: 'Jul', value: 73 },
          { label: 'Aug', value: 76 }, { label: 'Sep', value: 74 }, { label: 'Oct', value: 80, highlight: true },
        ]} height={220} />
      </Card>

      <div style={{ marginTop: 20 }}>
        <SectionHeader title="Revenue by Package — Monthly Detail" />
        <Table
          columns={[
            { label: 'Package', key: 'name', render: (r) => <span style={{ fontWeight: 700 }}>{r.name}</span> },
            { label: 'Price', key: 'price', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>${r.price}</span> },
            { label: 'Active', key: 'activeCount', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.activeCount}</span> },
            { label: 'MRR', key: 'mrr', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.mrr/1000).toFixed(1)}K</span> },
            { label: '% of Revenue', key: 'pctRevenue', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.pctRevenue}%</span> },
            { label: 'LTV', key: 'ltv', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>${r.ltv.toLocaleString()}</span> },
          ]}
          rows={demoData.revenueByPackage}
        />
      </div>
    </div>
  </div>
);

// ============================================
// 7. RETENTION DASHBOARD
// ============================================
const RetentionDashboard = ({ navigate }) => (
  <div>
    <PageHeader
      title="Retention Analytics"
      subtitle="Understand why members stay — and why they leave"
      actions={<Button variant="secondary" icon={Download}>Export</Button>}
    />

    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="Retention Rate" value="89.4%" delta={1.8} icon={TrendingUp} color="success" />
        <KPICard label="Churn Rate (monthly)" value="2.1%" delta={-0.4} icon={TrendingDown} color="success" />
        <KPICard label="Avg Lifetime" value="14.2" unit="mo" delta={8.1} icon={Clock} />
        <KPICard label="Avg LTV" value="$2,340" delta={12.3} icon={DollarSign} color="gold" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <SectionHeader title="Cohort Retention Heatmap" subtitle="Each row: a signup cohort. Columns show % retained over time." />
          <Card>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700, textAlign: 'left' }}>COHORT</th>
                    <th style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>SIZE</th>
                    {[0,1,2,3,4,5,6,7,8,9].map(m => <th key={m} style={{ padding: 8, fontSize: 10, color: brand.textMuted, fontWeight: 700 }}>M{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {demoData.cohortRetention.map((c, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${brand.border}` }}>
                      <td style={{ padding: 8, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.cohort}</td>
                      <td style={{ padding: 8, fontFamily: fonts.mono, textAlign: 'center' }}>{c.size}</td>
                      {[0,1,2,3,4,5,6,7,8,9].map(m => {
                        const v = c.retention[m];
                        if (v === undefined) return <td key={m} style={{ padding: 6 }}></td>;
                        const intensity = (v - 70) / 30;
                        return (
                          <td key={m} style={{ padding: 6 }}>
                            <div style={{ padding: '4px 6px', borderRadius: 4, background: `rgba(91, 138, 58, ${Math.max(0.15, intensity)})`, color: intensity > 0.5 ? brand.white : brand.text, fontWeight: 700, textAlign: 'center', fontFamily: fonts.mono, fontSize: 10 }}>
                              {v.toFixed(0)}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ marginTop: 20 }}>
            <SectionHeader title="Retention by Program" />
            <Card>
              {[
                { name: 'Unlimited Monthly', retention: 92.1, color: brand.success },
                { name: 'Team Training', retention: 94.2, color: brand.success },
                { name: '8-Pack Lessons', retention: 81.4, color: brand.warning },
                { name: '4-Pack Lessons', retention: 76.8, color: brand.warning },
                { name: 'Cage Rental', retention: 88.5, color: brand.success },
              ].map((p, i, arr) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${p.retention}%`, height: '100%', background: p.color }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, color: p.color, width: 60, textAlign: 'right' }}>{p.retention}%</div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        <div>
          <SectionHeader title="Why Members Leave" action={<Button variant="ghost" size="sm" onClick={() => navigate('churn-analysis')}>Full Analysis →</Button>} />
          <Card>
            {demoData.churnReasons.map((r, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < demoData.churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.reason}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display }}>{r.count} <span style={{ color: brand.textMuted, fontSize: 10 }}>({r.pct}%)</span></div>
                </div>
                <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct * 3}%`, height: '100%', background: brand.danger }} />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// 8. AT-RISK MEMBERS
// ============================================
const AtRiskMembers = ({ navigate }) => {
  const atRisk = demoData.members.filter(m => m.churnRisk === 'high' || m.churnRisk === 'medium');
  return (
    <div>
      <PageHeader
        title="At-Risk Members"
        subtitle={`${atRisk.length} members flagged by risk model · $${atRisk.reduce((s, m) => s + m.mrr, 0).toLocaleString()} monthly revenue at risk`}
        actions={<Button variant="gold" icon={Send}>Send Re-engagement Campaign</Button>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {atRisk.map(m => (
            <Card key={m.id} style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, fontFamily: fonts.display, flexShrink: 0 }}>
                  {m.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</div>
                        <Chip color={m.churnRisk === 'high' ? 'danger' : 'warning'}>{m.churnRisk.toUpperCase()} RISK</Chip>
                      </div>
                      <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>{m.age}U · {m.program} · ${m.mrr}/mo · LTV ${m.lifetime.toLocaleString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>LAST SESSION</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: brand.danger, marginTop: 2 }}>{m.lastSession}</div>
                    </div>
                  </div>
                  <div style={{ padding: 10, background: brand.surfaceAlt, borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>WHY FLAGGED</div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>{m.riskReason}</div>
                  </div>
                  <div style={{ padding: 10, background: `${brand.gold}15`, borderRadius: 8, marginBottom: 12, border: `1px solid ${brand.goldDeep}33` }}>
                    <div style={{ fontSize: 10, color: brand.goldDeep, fontWeight: 700, letterSpacing: 1, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Sparkles size={10} /> SUGGESTED ACTION
                    </div>
                    <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                      {m.churnRisk === 'high' ? 'Personal call from coach within 48 hours. Offer free comeback session. History suggests 72% recovery rate when coach calls within 2 weeks.' : 'Targeted message with progress highlights. Members in similar state respond to specific achievement reminders.'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="gold" size="sm" icon={Phone}>Call Parent</Button>
                    <Button variant="secondary" size="sm" icon={Mail}>Send Email</Button>
                    <Button variant="secondary" size="sm" icon={Gift}>Offer Free Session</Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate('member-detail')}>View Profile →</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// 9. CHURN ANALYSIS
// ============================================
const ChurnAnalysis = () => (
  <div>
    <PageHeader
      title="Churn Analysis"
      subtitle="Deep dive into why members leave and when"
    />
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="Monthly Churn" value="2.1%" delta={-0.4} icon={TrendingDown} color="success" />
        <KPICard label="Annual Churn" value="18.4%" delta={-3.2} icon={Activity} color="success" />
        <KPICard label="Lost Revenue YTD" value="$34,840" icon={AlertCircle} color="warning" />
        <KPICard label="Saves YTD" value="41" deltaLabel="recovered" icon={Shield} color="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <SectionHeader title="Churn by Tenure" subtitle="When do members leave?" />
          <BarChart data={[
            { label: '0-30d', value: 18 },
            { label: '1-3mo', value: 24 },
            { label: '3-6mo', value: 14 },
            { label: '6-12mo', value: 8 },
            { label: '1-2yr', value: 4 },
            { label: '2yr+', value: 2 },
          ]} height={180} />
          <div style={{ marginTop: 14, padding: 10, background: brand.warningBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
            <strong>Critical insight:</strong> 60% of churn happens in first 90 days. Focus retention efforts on new members.
          </div>
        </Card>

        <Card>
          <SectionHeader title="Churn by Age Group" />
          <BarChart data={[
            { label: '8U', value: 14 },
            { label: '10U', value: 18 },
            { label: '11U', value: 12 },
            { label: '12U', value: 10 },
            { label: '13U', value: 8 },
            { label: '14U+', value: 6 },
          ]} height={180} />
          <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
            Younger athletes (8-10U) churn more. Often tied to "lost interest" reason.
          </div>
        </Card>
      </div>

      <SectionHeader title="Exit Reasons — Detailed" />
      <Card>
        {demoData.churnReasons.map((r, i) => (
          <div key={i} style={{ padding: '14px 0', borderBottom: i < demoData.churnReasons.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${brand.danger}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <XCircle size={16} color={brand.danger} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.reason}</div>
              <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{r.count} members · {r.pct}% of total churn</div>
            </div>
            <div style={{ width: 200, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${r.pct * 3}%`, height: '100%', background: brand.danger }} />
            </div>
          </div>
        ))}
      </Card>
    </div>
  </div>
);

// ============================================
// 10. FRANCHISOR NETWORK DASHBOARD
// ============================================
const FranchisorDashboard = ({ navigate }) => {
  const k = demoData.networkKPIs;
  return (
    <div>
      <PageHeader
        title="Network Overview"
        subtitle={`${k.totalLocations} locations · ${k.totalMembers.toLocaleString()} members · Strong Q4 momentum`}
        actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={FileText}>Generate Report</Button></>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Network MRR" value={`$${(k.networkMRR/1000000).toFixed(2)}M`} delta={k.networkMRRDelta} icon={DollarSign} color="gold" />
          <KPICard label="Total Members" value={k.totalMembers.toLocaleString()} delta={7.2} icon={Users} />
          <KPICard label="Avg Retention" value={`${k.avgRetention}%`} delta={1.4} icon={TrendingUp} color="success" />
          <KPICard label="Network Churn" value={`${k.avgChurn}%`} delta={-0.8} icon={TrendingDown} color="warning" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Location Performance — Ranked" />
            <Table
              columns={[
                { label: 'Rank', key: 'rank', render: (r) => <span style={{ fontWeight: 800, fontFamily: fonts.display }}>#{r.rank}</span> },
                { label: 'Location', key: 'name', render: (r) => <div><div style={{ fontWeight: 700 }}>{r.name}</div><div style={{ fontSize: 11, color: brand.textMuted }}>{r.owner}</div></div> },
                { label: 'Members', key: 'members', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 600 }}>{r.members}</span> },
                { label: 'MRR', key: 'mrr', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.mrr/1000).toFixed(1)}K</span> },
                { label: 'Retention', key: 'retention', align: 'right', render: (r) => <span style={{ color: r.retention >= 88 ? brand.success : r.retention >= 85 ? brand.warning : brand.danger, fontWeight: 700 }}>{r.retention}%</span> },
                { label: 'Risk', key: 'churnRisk', render: (r) => <Chip color={r.churnRisk === 'low' ? 'success' : r.churnRisk === 'medium' ? 'warning' : 'danger'} size="sm">{r.churnRisk}</Chip> },
                { label: 'Trend', key: 'trend', align: 'right', render: (r) => <span style={{ color: r.trend >= 0 ? brand.success : brand.danger, fontWeight: 700 }}>{r.trend >= 0 ? '↑' : '↓'} {Math.abs(r.trend).toFixed(1)}%</span> },
              ]}
              rows={demoData.locations.map((l, i) => ({ ...l, rank: i + 1 }))}
              onRowClick={() => navigate('location-detail')}
            />
          </div>

          <div>
            <SectionHeader title="Network Alerts" />
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 12, background: brand.dangerBg, borderRadius: 8, border: `1px solid ${brand.danger}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertTriangle size={14} color={brand.danger} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Kansas City</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>Retention below 80% threshold. 6 months consecutive decline.</div>
                </div>
                <div style={{ padding: 12, background: brand.warningBg, borderRadius: 8, border: `1px solid ${brand.warning}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertCircle size={14} color={brand.warning} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Denver</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>MRR declining 2.8% month-over-month.</div>
                </div>
                <div style={{ padding: 12, background: brand.successBg, borderRadius: 8, border: `1px solid ${brand.success}33` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <CheckCircle2 size={14} color={brand.success} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Phoenix</div>
                  </div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>New monthly record. Up 14.8% vs last month.</div>
                </div>
              </div>
            </Card>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Royalty Pipeline" />
              <Card>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>This month</div>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, marginTop: 4 }}>$97,118</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 2 }}>+ $5,842 vs September</div>
                <div style={{ marginTop: 14, padding: 10, background: brand.surfaceAlt, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 4 }}>Auto-collected</div>
                  <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display }}>$92,340 <span style={{ fontSize: 10, color: brand.success }}>(95.1%)</span></div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 11. LOCATION DETAIL (Franchisor drill-down)
// ============================================
const LocationDetail = () => {
  const l = demoData.locations[3]; // Dallas N.
  return (
    <div>
      <PageHeader
        breadcrumb="Network → Dallas N."
        title={l.name}
        subtitle={`Owned by ${l.owner} · Opened June 2022 · ${l.members} members`}
        actions={<><Button variant="secondary" icon={MessageCircle}>Contact Owner</Button><Button variant="gold" icon={FileText}>Generate Review</Button></>}
      />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="MRR" value={`$${(l.mrr/1000).toFixed(1)}K`} delta={l.trend} icon={DollarSign} color="gold" />
          <KPICard label="Members" value={l.members} delta={4.2} icon={Users} />
          <KPICard label="Retention" value={`${l.retention}%`} delta={1.1} icon={TrendingUp} color="success" />
          <KPICard label="Royalty (mo)" value="$5,625" icon={DollarSign} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          <div>
            <SectionHeader title="Revenue Trend" />
            <Card>
              <BarChart data={[
                { label: 'May', value: 74 },
                { label: 'Jun', value: 71 },
                { label: 'Jul', value: 73 },
                { label: 'Aug', value: 76 },
                { label: 'Sep', value: 74 },
                { label: 'Oct', value: 80, highlight: true },
              ]} height={180} />
            </Card>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Member Engagement vs Network" />
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>APP OPEN RATE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>87%</div>
                    <div style={{ fontSize: 10, color: brand.success, fontWeight: 700, marginTop: 2 }}>+4% vs network</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>HOMEWORK DONE</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>72%</div>
                    <div style={{ fontSize: 10, color: brand.success, fontWeight: 700, marginTop: 2 }}>+8% vs network</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>AVG SESSIONS/MO</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, marginTop: 6 }}>6.4</div>
                    <div style={{ fontSize: 10, color: brand.success, fontWeight: 700, marginTop: 2 }}>+0.8 vs network</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div>
            <SectionHeader title="Compliance Status" />
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Brand standards audit', status: 'pass', date: 'Sep 15' },
                  { label: 'Monthly reporting', status: 'pass', date: 'On-time' },
                  { label: 'Royalty payments', status: 'pass', date: 'Current' },
                  { label: 'Insurance cert', status: 'warning', date: 'Expires in 45d' },
                  { label: 'Coach certifications', status: 'pass', date: 'All current' },
                ].map((c, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    {c.status === 'pass' ? <CheckCircle2 size={14} color={brand.success} /> : <AlertCircle size={14} color={brand.warning} />}
                    <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 10, color: brand.textMuted }}>{c.date}</div>
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Location Rank" />
              <Card>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>IN NETWORK</div>
                <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, marginTop: 4, color: brand.goldDeep }}>#4 <span style={{ fontSize: 14, color: brand.textMuted, fontWeight: 500 }}>of 17</span></div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 4 }}>↑ Up 2 spots this quarter</div>
                <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 10, lineHeight: 1.5 }}>Ranked by composite score: MRR growth, retention, member engagement, and compliance.</div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 12. POINTS & REWARDS CONFIG
// ============================================
const PointsRewardsConfig = () => {
  const [tab, setTab] = useState('rules');

  return (
    <div>
      <PageHeader
        title="Points & Rewards"
        subtitle="Configure the points system that drives athlete engagement"
        actions={<Button variant="gold" icon={Plus}>{tab === 'rules' ? 'Add Rule' : 'Add Reward'}</Button>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'rules', label: 'Earning Rules', count: demoData.pointsRules.length },
            { id: 'rewards', label: 'Rewards Catalog', count: demoData.rewardsCatalog.length },
          ].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: tab === t.id ? brand.dark : brand.surface,
              color: tab === t.id ? brand.gold : brand.textMuted,
              border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
              cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
            }}>
              {t.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
            </div>
          ))}
        </div>

        {tab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card padding={0}>
              {demoData.pointsRules.map((r, i, arr) => (
                <div key={r.id} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={16} color={brand.goldDeep} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.action}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>Active · auto-awarded</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>POINTS</div>
                    <div style={{ padding: '6px 14px', background: brand.dark, color: brand.gold, borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: fonts.display, minWidth: 50, textAlign: 'center' }}>+{r.points}</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: brand.success, position: 'relative', cursor: 'pointer' }}>
                    <div style={{ position: 'absolute', top: 2, left: 22, width: 20, height: 20, borderRadius: 10, background: brand.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                  <Edit2 size={14} color={brand.textMuted} style={{ cursor: 'pointer' }} />
                </div>
              ))}
            </Card>

            <div>
              <SectionHeader title="Impact Preview" />
              <Card>
                <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>AVG POINTS EARNED PER MEMBER / MONTH</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display }}>142</div>
                <div style={{ fontSize: 11, color: brand.success, fontWeight: 700, marginTop: 4 }}>↑ 18% since points launch</div>
                <div style={{ marginTop: 16, padding: 12, background: brand.infoBg, borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
                  <strong>Changes take effect immediately</strong> for all members. Historical points aren't affected.
                </div>
              </Card>

              <div style={{ marginTop: 20 }}>
                <SectionHeader title="Top Earners This Month" />
                <Card>
                  {['Jake Rodriguez', 'Noah Patel', 'Ethan Garcia', 'Jackson Hall'].map((n, i) => (
                    <div key={i} style={{ padding: '8px 0', borderBottom: i < 3 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? brand.gold : brand.dark, color: i === 0 ? brand.dark : brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display }}>{i+1}</div>
                      <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{n}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono }}>{[340, 295, 268, 244][i]} pts</div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <Table
            columns={[
              { label: 'Reward', key: 'name', render: (r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {r.category === 'Apparel' ? <ShoppingBag size={18} color={brand.goldDeep} /> :
                     r.category === 'Equipment' ? <Dumbbell size={18} color={brand.goldDeep} /> :
                     <Calendar size={18} color={brand.goldDeep} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{r.category}</div>
                  </div>
                </div>
              )},
              { label: 'Point Cost', key: 'cost', align: 'right', render: (r) => <span style={{ fontFamily: fonts.display, fontWeight: 700, color: brand.goldDeep }}>{r.cost} pts</span> },
              { label: 'Inventory', key: 'inventory', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.inventory}</span> },
              { label: 'Fulfilled', key: 'fulfilled', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.fulfilled}</span> },
              { label: 'Pending', key: 'pending', render: (r) => r.pending > 0 ? <Chip color="warning" size="sm">{r.pending} PENDING</Chip> : <span style={{ color: brand.textMuted }}>—</span> },
              { label: '', key: 'actions', render: () => <Edit2 size={14} color={brand.textMuted} /> },
            ]}
            rows={demoData.rewardsCatalog}
          />
        )}
      </div>
    </div>
  );
};

// ============================================
// 13. COACH MANAGEMENT
// ============================================
const CoachManagement = ({ navigate }) => (
  <div>
    <PageHeader
      title="Coach Management"
      subtitle={`${demoData.coaches.length} coaches on staff · ${demoData.coaches.reduce((s, c) => s + c.students, 0)} total students · Avg utilization 81%`}
      actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={Plus}>Hire Coach</Button></>}
    />

    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="Staff Size" value={demoData.coaches.length} icon={UserCog} />
        <KPICard label="Avg Utilization" value="81%" delta={3.2} icon={Activity} color="success" />
        <KPICard label="Avg Retention" value="89.9%" delta={1.4} icon={TrendingUp} color="success" />
        <KPICard label="Total Revenue" value={`$${(demoData.coaches.reduce((s, c) => s + c.revenue, 0) / 1000).toFixed(1)}K`} delta={8.7} icon={DollarSign} color="gold" />
      </div>

      <SectionHeader title="Coach Roster — Performance" />
      <Table
        columns={[
          { label: 'Coach', key: 'name', render: (r) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{r.name.split(' ')[1].charAt(0)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: brand.textMuted }}>{r.specialty}</div>
              </div>
            </div>
          )},
          { label: 'Students', key: 'students', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.students}</span> },
          { label: 'Utilization', key: 'utilization', render: (r) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${r.utilization}%`, height: '100%', background: r.utilization >= 80 ? brand.success : r.utilization >= 70 ? brand.warning : brand.danger }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.utilization}%</span>
            </div>
          )},
          { label: 'Retention', key: 'retention', align: 'right', render: (r) => <span style={{ color: r.retention >= 90 ? brand.success : brand.warning, fontWeight: 700 }}>{r.retention}%</span> },
          { label: 'Rating', key: 'avgRating', align: 'right', render: (r) => (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Star size={12} color={brand.goldDeep} fill={brand.goldDeep} />
              <span style={{ fontWeight: 700, fontFamily: fonts.display }}>{r.avgRating}</span>
            </div>
          )},
          { label: 'Revenue', key: 'revenue', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>${(r.revenue/1000).toFixed(1)}K</span> },
          { label: 'Hours/wk', key: 'weeklyHours', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.weeklyHours}</span> },
          { label: 'Joined', key: 'joinedDate', render: (r) => <span style={{ fontSize: 11, color: brand.textMuted }}>{r.joinedDate}</span> },
        ]}
        rows={demoData.coaches}
      />

      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <SectionHeader title="Utilization Distribution" />
          <BarChart data={demoData.coaches.map(c => ({ label: c.name.split(' ')[1].substring(0, 6), value: c.utilization, highlight: c.utilization >= 85 }))} height={180} />
          <div style={{ marginTop: 14, padding: 10, background: brand.successBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
            <strong>Derek Ross</strong> has highest utilization at 91%. Consider adding capacity to avoid burnout.
          </div>
        </Card>

        <Card>
          <SectionHeader title="Coach Retention Impact" subtitle="Student retention by coach" />
          {demoData.coaches.sort((a, b) => b.retention - a.retention).map((c, i, arr) => (
            <div key={c.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name.replace('Coach ', '')}</div>
              <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${c.retention}%`, height: '100%', background: c.retention >= 90 ? brand.success : brand.warning }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, color: c.retention >= 90 ? brand.success : brand.warning, width: 50, textAlign: 'right' }}>{c.retention}%</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  </div>
);

// ============================================
// 14. SCHEDULING & CAPACITY
// ============================================
const Scheduling = () => {
  const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM'];
  const cages = ['Cage 1', 'Cage 2', 'Cage 3', 'Cage 4', 'Cage 5', 'Cage 6', 'Cage 7', 'Cage 8'];

  const typeColors = {
    Private: { bg: `${brand.goldDeep}22`, border: brand.goldDeep, text: brand.text },
    Assessment: { bg: `${brand.info}22`, border: brand.info, text: brand.text },
    Group: { bg: `${brand.success}22`, border: brand.success, text: brand.text },
    Team: { bg: `${brand.warning}22`, border: brand.warning, text: brand.text },
  };

  return (
    <div>
      <PageHeader
        title="Schedule & Capacity"
        subtitle="Tuesday, October 22 · 8 cages · 6 coaches · 78% utilization today"
        actions={<><Button variant="secondary" icon={Filter}>Filter</Button><Button variant="gold" icon={Plus}>New Booking</Button></>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Today's Sessions" value="42" deltaLabel="booked" icon={Calendar} color="gold" />
          <KPICard label="Today's Occupancy" value="78%" delta={4.2} icon={Activity} color="success" />
          <KPICard label="Peak Hour" value="5 PM" deltaLabel="100% full" icon={TrendingUp} color="warning" />
          <KPICard label="Open Slots" value="14" deltaLabel="today" icon={Clock} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <Button variant="secondary" size="sm" icon={ChevronLeft}>Prev</Button>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, padding: '0 8px' }}>TUE · OCT 22, 2025</div>
          <Button variant="secondary" size="sm" icon={ChevronRight}>Next</Button>
          <Button variant="ghost" size="sm">Today</Button>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <Button variant="gold" size="sm">Day</Button>
            <Button variant="ghost" size="sm">Week</Button>
            <Button variant="ghost" size="sm">Month</Button>
          </div>
        </div>

        <Card padding={0}>
          <div style={{ overflow: 'auto' }}>
            <div style={{ minWidth: 900, padding: 16 }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr)', gap: 4, marginBottom: 8 }}>
                <div></div>
                {cages.map(c => (
                  <div key={c} style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, textAlign: 'center', letterSpacing: 0.5, padding: '6px 0', background: brand.surfaceAlt, borderRadius: 4 }}>{c.toUpperCase()}</div>
                ))}
              </div>
              {/* Time rows */}
              {hours.map((hr, hi) => (
                <div key={hi} style={{ display: 'grid', gridTemplateColumns: '60px repeat(8, 1fr)', gap: 4, marginBottom: 4, minHeight: 48 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: brand.textMuted, padding: '14px 0', textAlign: 'right', paddingRight: 8 }}>{hr}</div>
                  {cages.map((_, ci) => {
                    const booking = demoData.scheduleSlots.find(b => b.time === hi && b.cage === ci);
                    const tc = booking ? typeColors[booking.type] : null;
                    return (
                      <div key={ci} style={{
                        background: booking ? tc.bg : brand.creamLight,
                        borderRadius: 6, padding: 6,
                        border: `1px solid ${booking ? tc.border : brand.border}`,
                        cursor: 'pointer',
                        minHeight: 42,
                      }}>
                        {booking && (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: tc.text }}>{booking.name}</div>
                            <div style={{ fontSize: 9, color: brand.textMuted, marginTop: 2 }}>{booking.coach}</div>
                            <div style={{ fontSize: 8, color: tc.border, fontWeight: 800, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: fonts.display }}>{booking.type}</div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Card>
            <SectionHeader title="Peak Hour Analysis" subtitle="Average weekly utilization" />
            <BarChart data={[
              { label: '9 AM', value: 32 },
              { label: '10 AM', value: 48 },
              { label: '11 AM', value: 56 },
              { label: '12 PM', value: 42 },
              { label: '1 PM', value: 38 },
              { label: '2 PM', value: 52 },
              { label: '3 PM', value: 74 },
              { label: '4 PM', value: 92, highlight: true },
              { label: '5 PM', value: 100, highlight: true },
              { label: '6 PM', value: 96, highlight: true },
              { label: '7 PM', value: 78 },
              { label: '8 PM', value: 48 },
            ]} height={180} />
            <div style={{ marginTop: 14, padding: 10, background: brand.warningBg, borderRadius: 8, fontSize: 11, color: brand.text, lineHeight: 1.5 }}>
              <strong>4-7 PM is near capacity.</strong> Consider adding staff or incentivizing off-peak bookings.
            </div>
          </Card>

          <Card>
            <SectionHeader title="Session Type Breakdown" />
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <DonutChart data={[
                { value: 11, color: brand.goldDeep },
                { value: 1, color: brand.info },
                { value: 2, color: brand.success },
                { value: 2, color: brand.warning },
              ]} size={140} />
              <div style={{ flex: 1 }}>
                {[
                  { label: 'Private Lessons', count: 11, color: brand.goldDeep },
                  { label: 'Assessments', count: 1, color: brand.info },
                  { label: 'Group Classes', count: 2, color: brand.success },
                  { label: 'Team Training', count: 2, color: brand.warning },
                ].map((t, i) => (
                  <div key={i} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color }} />
                    <div style={{ flex: 1 }}>{t.label}</div>
                    <div style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{t.count}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ============================================
// 15. MISSING IN ACTION (MIA)
// ============================================
const MissingInAction = ({ navigate }) => {
  const [tab, setTab] = useState('7');
  const groups = {
    '7': demoData.missingInAction.sevenDay,
    '14': demoData.missingInAction.fourteenDay,
    '30': demoData.missingInAction.thirtyDay,
  };
  const current = groups[tab];

  const totalRevenueAtRisk = [
    ...demoData.missingInAction.sevenDay,
    ...demoData.missingInAction.fourteenDay,
    ...demoData.missingInAction.thirtyDay,
  ].reduce((s, m) => s + m.mrr, 0);

  return (
    <div>
      <PageHeader
        title="Missing in Action"
        subtitle={`Attendance-based early warning · Early intervention dramatically improves retention`}
        actions={<><Button variant="secondary" icon={Download}>Export</Button><Button variant="gold" icon={Send}>Send Group Email</Button></>}
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Missing 7+ Days" value={demoData.missingInAction.sevenDay.length} icon={Clock} color="warning" />
          <KPICard label="Missing 14+ Days" value={demoData.missingInAction.fourteenDay.length} icon={AlertCircle} color="warning" />
          <KPICard label="Missing 30+ Days" value={demoData.missingInAction.thirtyDay.length} icon={AlertTriangle} color="danger" />
          <KPICard label="Revenue at Risk" value={`$${totalRevenueAtRisk.toLocaleString()}`} deltaLabel="monthly" icon={DollarSign} color="danger" />
        </div>

        <div style={{ padding: 14, background: brand.infoBg, borderRadius: 10, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.info, color: brand.white, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} />
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: brand.text, flex: 1 }}>
            <strong>Why this matters:</strong> Youth sports members who miss 14+ days have a 68% probability of churning within the next 30 days. Members who miss 30+ days churn 82% of the time. <strong>A single outreach call recovers roughly 1 in 3.</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: '7', label: '7+ Days', count: demoData.missingInAction.sevenDay.length, color: brand.warning },
            { id: '14', label: '14+ Days', count: demoData.missingInAction.fourteenDay.length, color: brand.warning },
            { id: '30', label: '30+ Days', count: demoData.missingInAction.thirtyDay.length, color: brand.danger },
          ].map(t => (
            <div key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: tab === t.id ? brand.dark : brand.surface,
              color: tab === t.id ? brand.gold : brand.textMuted,
              border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
              cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {t.label}
              <div style={{ padding: '2px 8px', borderRadius: 10, background: tab === t.id ? brand.gold : `${t.color}22`, color: tab === t.id ? brand.dark : t.color, fontSize: 11, fontWeight: 800, fontFamily: fonts.display }}>{t.count}</div>
            </div>
          ))}
        </div>

        <SectionHeader title={`Members missing ${tab}+ days`} subtitle="Sorted by last session date — oldest first" />
        <Table
          columns={[
            { label: 'Member', key: 'name', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>{r.name.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: brand.textMuted }}>{r.age}U · {r.coach}</div>
                </div>
              </div>
            )},
            { label: 'Last Session', key: 'lastSession', render: (r) => (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: parseInt(r.lastSession) >= 14 ? brand.danger : brand.warning }}>{r.lastSession}</div>
                <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 2 }}>{r.lastDate}</div>
              </div>
            )},
            { label: 'Program', key: 'program', render: (r) => <div><div style={{ fontSize: 12, fontWeight: 600 }}>{r.program}</div><div style={{ fontSize: 10, color: brand.textMuted }}>${r.mrr}/mo</div></div> },
            { label: 'Sessions Done', key: 'totalSessions', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.totalSessions}</span> },
            { label: 'Tenure', key: 'tenure', render: (r) => <span style={{ fontSize: 12 }}>{r.tenure}</span> },
            { label: 'Engagement', key: 'engagementScore', render: (r) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 50, height: 5, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${r.engagementScore}%`, height: '100%', background: r.engagementScore >= 60 ? brand.warning : brand.danger }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{r.engagementScore}</div>
              </div>
            )},
            { label: 'Actions', key: 'actions', render: () => (
              <div style={{ display: 'flex', gap: 4 }}>
                <Button variant="gold" size="sm" icon={Phone}>Call</Button>
                <Button variant="secondary" size="sm" icon={Mail}>Email</Button>
                <Button variant="ghost" size="sm" icon={MessageCircle} />
              </div>
            )},
          ]}
          rows={current}
        />

        {current.length === 0 && (
          <Card style={{ textAlign: 'center', padding: 40 }}>
            <CheckCircle2 size={48} color={brand.success} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>No members in this group</div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 4 }}>Great attendance. Keep it up.</div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============================================
// APP SHELL
// ============================================
export default function App() {
  const [role, setRole] = useState('owner');
  const [screen, setScreen] = useState('owner-dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setScreen(newRole === 'franchisor' ? 'franchisor-dashboard' : 'owner-dashboard');
  };

  const renderScreen = () => {
    switch (screen) {
      case 'owner-dashboard': return <OwnerDashboard navigate={setScreen} />;
      case 'members-list': return <MembersList navigate={setScreen} />;
      case 'member-detail': return <MemberDetail navigate={setScreen} />;
      case 'billing-dashboard': return <BillingDashboard navigate={setScreen} />;
      case 'failed-payments': return <FailedPayments />;
      case 'revenue-reports': return <RevenueReports />;
      case 'retention-dashboard': return <RetentionDashboard navigate={setScreen} />;
      case 'at-risk': return <AtRiskMembers navigate={setScreen} />;
      case 'churn-analysis': return <ChurnAnalysis />;
      case 'franchisor-dashboard': return <FranchisorDashboard navigate={setScreen} />;
      case 'location-detail': return <LocationDetail />;
      case 'points-rules': return <PointsRewardsConfig />;
      case 'coach-management': return <CoachManagement navigate={setScreen} />;
      case 'scheduling': return <Scheduling />;
      case 'missing-in-action': return <MissingInAction navigate={setScreen} />;
      default: return <OwnerDashboard navigate={setScreen} />;
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: brand.cream, fontFamily: fonts.body, color: brand.text, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', background: brand.darkest, color: brand.gold, fontSize: 11, fontWeight: 700, letterSpacing: 2, textAlign: 'center', fontFamily: fonts.display }}>
        INFINITE HITTING — OPERATIONS PORTAL · PROTOTYPE v0.2 · 15 SCREENS
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          currentScreen={screen}
          navigate={setScreen}
          role={role}
          collapsed={sidebarCollapsed}
          toggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar
            role={role}
            setRole={handleRoleChange}
            user={role === 'franchisor' ? demoData.franchisor : demoData.owner}
            location={demoData.location}
          />
          <div style={{ flex: 1, overflow: 'auto', background: brand.cream }}>
            {renderScreen()}
          </div>
        </div>
      </div>
    </div>
  );
}
