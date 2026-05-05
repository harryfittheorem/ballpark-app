import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Home, Calendar, MessageCircle, User, Flame, Trophy, PlayCircle, Video, ShoppingBag, Bell, TrendingUp, Award, Target, Zap, Share2, Check, Plus, ArrowRight, Clock, Send, Camera, Upload, Gift, Sparkles, Dumbbell, BarChart3, Star, Lock, Eye, Heart, Play, Filter, MoreVertical, Paperclip, Download, Copy, Image as ImageIcon, X, Instagram, CalendarDays, Users as UsersIcon, Briefcase, MapPin, CreditCard, ShoppingCart, Tag, Minus, Package, Hash } from 'lucide-react';

// ============================================
// BRAND TOKENS
// ============================================
const brand = {
  dark: '#2D2B2A', darker: '#1C1B1A', darkest: '#0F0E0E',
  gold: '#F1E5AD', goldBright: '#E8D89A', goldDeep: '#B8A268',
  cream: '#FAF6E8', white: '#FFFFFF',
  muted: '#6B6560', border: '#3A3836',
  borderGold: 'rgba(241, 229, 173, 0.2)',
  success: '#A8C67F', warning: '#E8A747', danger: '#C86B5C',
  info: '#7BA8C4',
};

const fonts = {
  display: "'Oswald', 'Bebas Neue', 'Impact', sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// ============================================
// DATA
// ============================================
const generateSwings = () => {
  const sess = [
    { sessionId: 1, date: 'Oct 18', time: '5:12 PM', sessionName: 'Hitting' },
    { sessionId: 2, date: 'Oct 15', time: '5:45 PM', sessionName: 'Hitting' },
    { sessionId: 3, date: 'Oct 11', time: '4:30 PM', sessionName: 'Group Class' },
    { sessionId: 4, date: 'Oct 8', time: '5:00 PM', sessionName: 'Hitting' },
    { sessionId: 5, date: 'Oct 4', time: '6:15 PM', sessionName: 'Assessment' },
  ];
  let swingId = 1;
  const all = [];
  sess.forEach(s => {
    const count = s.sessionId === 1 ? 28 : s.sessionId === 2 ? 32 : s.sessionId === 3 ? 24 : s.sessionId === 4 ? 30 : 20;
    const base = s.sessionId === 1 ? 66 : s.sessionId === 2 ? 64 : s.sessionId === 3 ? 62 : s.sessionId === 4 ? 63 : 61;
    for (let i = 0; i < count; i++) {
      const velo = Math.round(base + Math.random() * 8 - 2);
      const angle = Math.round(8 + Math.random() * 14);
      const distance = Math.round(velo * 3.2 + Math.random() * 20);
      const isPR = s.sessionId === 1 && i === 6;
      const isGreat = velo >= 68;
      all.push({
        id: swingId++, sessionId: s.sessionId, session: s, swingNumber: i + 1,
        exitVelo: velo, launchAngle: angle, distance,
        isPR, isGreat, isContact: Math.random() > 0.2,
        isFavorite: isPR || (isGreat && Math.random() > 0.7),
        result: velo > 68 ? 'Home Run' : velo > 64 ? 'Extra Base' : velo > 60 ? 'Single' : 'Out',
      });
    }
  });
  return all;
};

const allSwings = generateSwings();

const sessions = [
  { id: 1, date: 'Oct 18', time: '5:12 PM', sessionName: 'Hitting w/ Coach Mike', swingCount: 28, avgVelo: 65, bestVelo: 68, hasPR: true },
  { id: 2, date: 'Oct 15', time: '5:45 PM', sessionName: 'Hitting w/ Coach Mike', swingCount: 32, avgVelo: 63, bestVelo: 66, hasPR: false },
  { id: 3, date: 'Oct 11', time: '4:30 PM', sessionName: 'Group Class', swingCount: 24, avgVelo: 61, bestVelo: 64, hasPR: false },
  { id: 4, date: 'Oct 8', time: '5:00 PM', sessionName: 'Hitting w/ Coach Mike', swingCount: 30, avgVelo: 62, bestVelo: 65, hasPR: false },
  { id: 5, date: 'Oct 4', time: '6:15 PM', sessionName: 'Swing Assessment', swingCount: 20, avgVelo: 60, bestVelo: 63, hasPR: false },
];

const homeworkVideos = [
  { id: 1, title: 'Tee drills — inside pitch', dateSubmitted: 'Oct 19', coachNote: 'Hands stayed inside the ball perfectly. This is the feel we want.', rating: 5, duration: '0:42' },
  { id: 2, title: 'Front toss — contact focus', dateSubmitted: 'Oct 17', coachNote: 'Great rhythm. Work on your follow-through finish.', rating: 4, duration: '1:12' },
  { id: 3, title: 'Vision training — pitch recognition', dateSubmitted: 'Oct 14', coachNote: 'Solid. You are reading curves better than last month.', rating: 4, duration: '0:38' },
];

// Unified message thread — text AND video in same stream
const messageThread = [
  { id: 1, from: 'coach', type: 'text', text: 'Great session today. You locked in on the inside pitch work.', time: 'Today, 3:12 PM' },
  { id: 2, from: 'coach', type: 'video', label: 'SWING ANALYSIS', title: 'Quick fix for your stride timing', duration: '1:23', note: "Watch this back — I marked up your stride. Focus on what happens in frame 4.", time: 'Today, 3:14 PM' },
  { id: 3, from: 'user', type: 'text', text: "Got it Coach. I'll watch this tonight.", time: 'Today, 6:08 PM' },
  { id: 4, from: 'coach', type: 'text', text: '👍', time: 'Today, 6:10 PM' },
  { id: 5, from: 'user', type: 'video', label: 'GAME FOOTAGE', title: 'My at-bat from Saturday', duration: '0:18', note: "Coach, can you check my swing here? Felt off.", sentBy: 'Dad', time: 'Yesterday, 7:42 PM' },
  { id: 6, from: 'coach', type: 'text', text: 'Nice hit! Your hands are in a great spot. Keep this.', time: 'Yesterday, 8:15 PM' },
  { id: 7, from: 'coach', type: 'video', label: 'INSPIRATION', title: 'Juan Soto inside pitch — watch the hands', duration: '0:45', note: "This is the hand path we've been working on. See how quiet they stay.", time: 'Oct 17' },
  { id: 8, from: 'user', type: 'text', text: 'Whoa that was sick', time: 'Oct 17' },
  { id: 9, from: 'user', type: 'video', label: 'HOME PRACTICE', title: 'Tee work Wednesday morning', duration: '1:05', note: "Did 20 reps. Felt better.", time: 'Oct 15' },
];

const demoData = {
  kid: { firstName: 'Jake', lastName: 'Rodriguez', points: 340, streak: 14, rank: 12, ageGroup: '11U', location: 'Infinite Hitting Dallas N.' },
  assignments: [
    { id: 1, title: 'Tee drills — inside pitch', assignedBy: 'Coach Mike', dueDate: 'Thursday', status: 'pending', reward: 25, duration: '15 min' },
    { id: 2, title: 'Front toss — contact focus', assignedBy: 'Coach Mike', dueDate: 'Friday', status: 'pending', reward: 25, duration: '10 min' },
    { id: 3, title: 'Vision training — pitch recognition', assignedBy: 'Coach Mike', dueDate: 'Saturday', status: 'submitted', reward: 25, duration: '5 min' },
    { id: 4, title: 'Bat speed drill — short swings', assignedBy: 'Coach Mike', dueDate: 'Completed', status: 'reviewed', reward: 25, duration: '12 min' },
  ],
  rewards: [
    { id: 1, name: 'Infinite Hitting Tee', category: 'Apparel', pointsCost: 400, dollarPrice: 28, icon: 'shirt', description: 'Premium performance t-shirt' },
    { id: 2, name: 'Free Training Session', category: 'Sessions', pointsCost: 600, dollarPrice: 58, icon: 'session', description: 'One 45-min private lesson' },
    { id: 3, name: 'Custom Training Bat', category: 'Equipment', pointsCost: 1200, dollarPrice: 89, icon: 'bat', description: 'Official IH training bat' },
    { id: 4, name: 'IH Hoodie — Legacy', category: 'Apparel', pointsCost: 800, dollarPrice: 58, icon: 'hoodie', description: 'Embroidered logo hoodie' },
    { id: 5, name: 'Batting Gloves', category: 'Equipment', pointsCost: 500, dollarPrice: 38, icon: 'gloves', description: 'Youth performance gloves' },
    { id: 6, name: 'Holiday Camp Entry', category: 'Sessions', pointsCost: 1500, dollarPrice: 195, icon: 'camp', description: '3-day holiday camp' },
    { id: 7, name: 'IH Cap — Gold Crest', category: 'Apparel', pointsCost: 350, dollarPrice: 24, icon: 'cap', description: 'Embroidered crest cap' },
    { id: 8, name: 'Batting Helmet', category: 'Equipment', pointsCost: 900, dollarPrice: 72, icon: 'helmet', description: 'Youth-sized helmet' },
  ],
  earningRules: [
    { action: 'Attend a training session', points: 10, icon: 'check' },
    { action: 'Complete a homework assignment', points: 25, icon: 'target' },
    { action: 'Hit a new personal best', points: 15, icon: 'trophy' },
    { action: 'Streak milestone (every 7 days)', points: 30, icon: 'flame' },
    { action: 'Top 10 weekly leaderboard', points: 50, icon: 'award' },
    { action: 'Refer a friend', points: 100, icon: 'gift' },
  ],
  pointsActivity: [
    { action: 'Completed homework: Tee drills', points: 25, date: 'Today' },
    { action: 'Session attended', points: 10, date: 'Yesterday' },
    { action: 'New personal best: Exit velo 68mph', points: 15, date: 'Oct 15' },
    { action: 'Streak milestone: 14 days', points: 30, date: 'Oct 14' },
  ],
  drillLibrary: [
    { id: 1, title: 'Load & Stride Fundamentals', category: 'Hitting Mechanics', duration: '4:32', level: 'Beginner' },
    { id: 2, title: 'Inside Pitch Approach', category: 'Hitting Mechanics', duration: '6:18', level: 'Intermediate' },
    { id: 3, title: 'Two-Strike Adjustments', category: 'Situational', duration: '5:44', level: 'Advanced' },
    { id: 4, title: 'Vision Training Basics', category: 'Mental', duration: '3:21', level: 'Beginner' },
  ],
  leaderboard: [
    { rank: 1, name: 'Marcus T.', location: 'Phoenix', value: 74 },
    { rank: 2, name: 'Ethan K.', location: 'Austin', value: 72 },
    { rank: 3, name: 'Diego M.', location: 'Dallas N.', value: 71 },
    { rank: 4, name: 'Ryan P.', location: 'San Antonio', value: 70 },
    { rank: 5, name: 'Tyler J.', location: 'Houston', value: 70 },
    { rank: 12, name: 'Jake Rodriguez', location: 'Dallas N.', value: 68, isYou: true },
  ],
  bookingTypes: [
    { id: 'private', label: 'Private Lesson', desc: '1-on-1 with a coach', duration: '45 min', icon: 'user', priceRange: '$48', eligibility: 'Included with Unlimited · Private members' },
    { id: 'group', label: 'Group Class', desc: '4-8 kids, age-based', duration: '60 min', icon: 'users', priceRange: '$28', eligibility: 'Included with Unlimited members' },
    { id: 'cage', label: 'Cage Rental', desc: 'Open cage time', duration: '30 min', icon: 'hash', priceRange: '$15', eligibility: 'Members & non-members' },
  ],
  bookingSlots: [
    { id: 1, date: 'Today', dayLabel: 'Tue, Oct 22', slots: [
      { time: '3:00 PM', coach: 'Coach Sarah', cage: 'Cage 2', available: true, type: 'private' },
      { time: '4:00 PM', coach: 'Coach Derek', cage: 'Cage 4', available: true, type: 'private' },
      { time: '5:00 PM', coach: 'Coach Mike', cage: 'Cage 3', available: true, type: 'private' },
      { time: '6:00 PM', coach: 'Group Class · 11U', cage: 'Cage 5', available: true, type: 'group' },
    ]},
    { id: 2, date: 'Tomorrow', dayLabel: 'Wed, Oct 23', slots: [
      { time: '3:00 PM', coach: 'Coach Amanda', cage: 'Cage 3', available: true, type: 'private' },
      { time: '4:00 PM', coach: 'Coach Mike', cage: 'Cage 3', available: false, type: 'private' },
      { time: '5:00 PM', coach: 'Coach Mike', cage: 'Cage 3', available: true, type: 'private' },
      { time: '6:00 PM', coach: 'Group Class · 11U', cage: 'Cage 5', available: true, type: 'group' },
      { time: '7:00 PM', coach: 'Cage 4 — Open', cage: 'Cage 4', available: true, type: 'cage' },
    ]},
    { id: 3, date: 'Thursday', dayLabel: 'Thu, Oct 24', slots: [
      { time: '10:00 AM', coach: 'Coach Derek', cage: 'Cage 1', available: true, type: 'private' },
      { time: '2:00 PM', coach: 'Coach Derek', cage: 'Cage 4', available: true, type: 'private' },
      { time: '5:00 PM', coach: 'Coach Mike', cage: 'Cage 3', available: true, type: 'private' },
    ]},
  ],
  upcomingBookings: [
    { id: 1, title: 'Hitting w/ Coach Mike', date: 'Today', time: '5:00 PM', cage: 'Cage 3', type: 'private' },
    { id: 2, title: 'Group Class · 11U', date: 'Thursday', time: '6:00 PM', cage: 'Cage 5', type: 'group' },
  ],
  orderHistory: [
    { id: 1, itemName: 'Infinite Hitting Tee', date: 'Oct 15', method: 'points', amount: 400, status: 'Fulfilled' },
    { id: 2, itemName: 'Batting Gloves', date: 'Oct 2', method: 'purchase', amount: 38, status: 'Fulfilled' },
    { id: 3, itemName: 'Free Training Session', date: 'Sep 28', method: 'points', amount: 600, status: 'Redeemed' },
  ],
};

const getNextReward = (points) => {
  const sorted = [...demoData.rewards].sort((a, b) => a.pointsCost - b.pointsCost);
  return sorted.find(r => r.pointsCost > points) || sorted[sorted.length - 1];
};

// ============================================
// PHONE FRAME
// ============================================
const PhoneFrame = ({ children }) => (
  <div style={{ width: 390, height: 844, background: brand.darkest, borderRadius: 48, overflow: 'hidden', position: 'relative', boxShadow: '0 30px 80px -15px rgba(0,0,0,0.5), 0 0 0 12px #0a0a0a, 0 0 0 13px #2a2a2a', fontFamily: fonts.body, color: brand.white }}>
    <div style={{ height: 47, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', fontSize: 14, fontWeight: 600, color: brand.white, position: 'relative', zIndex: 10 }}>
      <span>9:41</span>
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: 120, height: 30, background: '#000', borderRadius: 20 }} />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ fontSize: 11 }}>5G</div>
        <div style={{ width: 24, height: 11, border: `1px solid ${brand.white}`, borderRadius: 3, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 1, background: brand.white, borderRadius: 1, width: '80%' }} />
        </div>
      </div>
    </div>
    <div style={{ height: 'calc(100% - 47px)', overflow: 'hidden', position: 'relative' }}>{children}</div>
  </div>
);

const SectionLabel = ({ children, action, onActionClick }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
    <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{children}</div>
    {action && <div onClick={onActionClick} style={{ fontSize: 11, color: brand.gold, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }}>{action} →</div>}
  </div>
);

const PointsBadge = ({ points, size = 'sm' }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: brand.gold, color: brand.dark, padding: size === 'lg' ? '6px 12px' : '3px 8px', borderRadius: 20, fontWeight: 800, fontSize: size === 'lg' ? 13 : 11, fontFamily: fonts.display, letterSpacing: 0.5 }}>
    <Sparkles size={size === 'lg' ? 13 : 11} strokeWidth={2.5} />
    +{points}
  </div>
);

const Chip = ({ children, color = 'default', size = 'md' }) => {
  const colors = {
    default: { bg: brand.darker, text: brand.muted },
    success: { bg: `${brand.success}22`, text: brand.success },
    warning: { bg: `${brand.warning}22`, text: brand.warning },
    danger: { bg: `${brand.danger}22`, text: brand.danger },
  };
  const c = colors[color];
  return (
    <span style={{ padding: size === 'sm' ? '2px 7px' : '3px 10px', background: c.bg, color: c.text, borderRadius: 20, fontSize: size === 'sm' ? 9 : 11, fontWeight: 800, letterSpacing: 0.5, fontFamily: fonts.display }}>{children}</span>
  );
};

// ============================================
// PRODUCT VISUAL — stylized gradient-based product imagery
// Rich, branded, no external URLs, zero licensing risk
// ============================================
const ProductVisual = ({ item, size = 'md' }) => {
  // Map each category/icon type to its own visual treatment
  const treatments = {
    shirt: {
      bg: `radial-gradient(circle at 30% 30%, #4a4845 0%, #2a2826 60%, #1a1817 100%)`,
      pattern: 'tshirt',
      accent: brand.gold,
    },
    hoodie: {
      bg: `radial-gradient(circle at 70% 20%, #3d3b38 0%, #262422 60%, #151413 100%)`,
      pattern: 'hoodie',
      accent: brand.goldBright,
    },
    cap: {
      bg: `radial-gradient(circle at 50% 30%, #3a3835 0%, #252321 70%, #161514 100%)`,
      pattern: 'cap',
      accent: brand.gold,
    },
    bat: {
      bg: `linear-gradient(135deg, #2a2725 0%, #1a1816 50%, #0e0d0c 100%)`,
      pattern: 'bat',
      accent: brand.gold,
    },
    gloves: {
      bg: `radial-gradient(circle at 40% 50%, #4e3d2a 0%, #2c2218 60%, #171210 100%)`,
      pattern: 'gloves',
      accent: '#d4a56a',
    },
    helmet: {
      bg: `radial-gradient(circle at 60% 40%, #3a3835 0%, #222120 60%, #141313 100%)`,
      pattern: 'helmet',
      accent: brand.gold,
    },
    session: {
      bg: `linear-gradient(135deg, #2d4a5a 0%, #1a2e3a 50%, #0e1a22 100%)`,
      pattern: 'session',
      accent: brand.gold,
    },
    camp: {
      bg: `linear-gradient(135deg, #5a4a2d 0%, #3a2e1a 50%, #22180e 100%)`,
      pattern: 'camp',
      accent: brand.goldBright,
    },
  };

  const t = treatments[item.icon] || treatments.shirt;
  const iconSize = size === 'lg' ? 90 : size === 'md' ? 54 : 38;

  // SVG silhouettes for each category
  const renderPattern = () => {
    const s = iconSize;
    const c = t.accent;
    switch (t.pattern) {
      case 'tshirt':
        return (
          <svg width={s * 1.4} height={s * 1.4} viewBox="0 0 100 100" fill="none">
            <path d="M25 25 L35 15 L42 18 Q50 22 58 18 L65 15 L75 25 L82 32 L75 40 L70 35 L70 82 Q70 85 67 85 L33 85 Q30 85 30 82 L30 35 L25 40 L18 32 Z" fill={c} opacity="0.92" />
            <path d="M42 18 Q50 25 58 18" stroke={brand.dark} strokeWidth="1.5" fill="none" opacity="0.4" />
          </svg>
        );
      case 'hoodie':
        return (
          <svg width={s * 1.4} height={s * 1.4} viewBox="0 0 100 100" fill="none">
            <path d="M30 30 Q30 15 50 15 Q70 15 70 30 L78 35 L85 45 L78 52 L72 48 L72 85 Q72 88 69 88 L31 88 Q28 88 28 85 L28 48 L22 52 L15 45 L22 35 Z" fill={c} opacity="0.92" />
            <path d="M35 22 Q50 18 65 22 L65 32 L35 32 Z" fill={brand.dark} opacity="0.25" />
            <line x1="50" y1="40" x2="50" y2="65" stroke={brand.dark} strokeWidth="1" opacity="0.3" />
          </svg>
        );
      case 'cap':
        return (
          <svg width={s * 1.5} height={s * 1.5} viewBox="0 0 100 100" fill="none">
            <path d="M22 55 Q22 32 50 32 Q78 32 78 55 L78 62 L22 62 Z" fill={c} opacity="0.92" />
            <path d="M22 62 Q15 65 15 70 L85 70 Q85 65 78 62 Z" fill={c} opacity="0.75" />
            <circle cx="50" cy="48" r="6" fill={brand.dark} opacity="0.35" />
          </svg>
        );
      case 'bat':
        return (
          <svg width={s * 1.6} height={s * 1.6} viewBox="0 0 100 100" fill="none" style={{ transform: 'rotate(-30deg)' }}>
            <ellipse cx="70" cy="30" rx="14" ry="22" fill={c} opacity="0.92" />
            <rect x="30" y="50" width="10" height="38" rx="5" fill={c} opacity="0.85" transform="rotate(-45 35 69)" />
            <rect x="60" y="40" width="8" height="28" rx="4" fill={c} opacity="0.9" transform="rotate(-45 64 54)" />
            <circle cx="28" cy="75" r="5" fill={brand.dark} opacity="0.5" />
          </svg>
        );
      case 'gloves':
        return (
          <svg width={s * 1.5} height={s * 1.5} viewBox="0 0 100 100" fill="none">
            <path d="M20 55 Q20 35 30 30 L35 28 Q38 20 43 20 Q48 22 48 30 L50 30 Q52 18 58 18 Q64 20 63 32 L66 32 Q70 24 75 26 Q80 30 78 42 L80 45 Q82 50 78 55 L78 75 Q78 82 70 82 L30 82 Q20 82 20 75 Z" fill={c} opacity="0.92" />
            <path d="M30 60 L70 60" stroke={brand.dark} strokeWidth="1" opacity="0.3" />
            <path d="M30 68 L70 68" stroke={brand.dark} strokeWidth="1" opacity="0.3" />
          </svg>
        );
      case 'helmet':
        return (
          <svg width={s * 1.4} height={s * 1.4} viewBox="0 0 100 100" fill="none">
            <path d="M20 55 Q20 25 50 25 Q80 25 80 55 L80 70 Q80 75 75 75 L65 75 L65 68 L35 68 L35 75 L25 75 Q20 75 20 70 Z" fill={c} opacity="0.92" />
            <rect x="35" y="55" width="30" height="6" rx="3" fill={brand.dark} opacity="0.5" />
            <path d="M28 45 Q40 40 50 40 Q60 40 72 45" stroke={brand.dark} strokeWidth="1" opacity="0.25" fill="none" />
          </svg>
        );
      case 'session':
        return (
          <svg width={s * 1.4} height={s * 1.4} viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="32" stroke={c} strokeWidth="3" opacity="0.9" fill="none" />
            <path d="M50 32 L50 50 L62 58" stroke={c} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
            <circle cx="50" cy="50" r="3" fill={c} />
          </svg>
        );
      case 'camp':
        return (
          <svg width={s * 1.5} height={s * 1.5} viewBox="0 0 100 100" fill="none">
            <path d="M50 20 L80 80 L20 80 Z" fill={c} opacity="0.92" />
            <path d="M50 40 L65 75 L35 75 Z" fill={brand.dark} opacity="0.35" />
            <circle cx="50" cy="30" r="3" fill={brand.dark} opacity="0.5" />
            <path d="M10 85 L90 85" stroke={c} strokeWidth="2" opacity="0.6" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{
      width: '100%',
      aspectRatio: '1',
      background: t.bg,
      borderRadius: size === 'lg' ? 20 : 10,
      position: 'relative',
      overflow: 'hidden',
      border: `1px solid ${brand.borderGold}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Subtle vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.35) 100%)`,
        pointerEvents: 'none',
      }} />
      {/* Corner brand mark */}
      <div style={{
        position: 'absolute',
        top: size === 'lg' ? 14 : 7,
        left: size === 'lg' ? 14 : 7,
        fontSize: size === 'lg' ? 9 : 6,
        fontWeight: 800,
        color: brand.gold,
        letterSpacing: size === 'lg' ? 2 : 1.2,
        fontFamily: fonts.display,
        opacity: 0.7,
      }}>INFINITE HITTING</div>
      {/* Category tag bottom-right */}
      <div style={{
        position: 'absolute',
        bottom: size === 'lg' ? 14 : 7,
        right: size === 'lg' ? 14 : 7,
        fontSize: size === 'lg' ? 8 : 6,
        fontWeight: 700,
        color: brand.gold,
        letterSpacing: size === 'lg' ? 1.5 : 1,
        fontFamily: fonts.display,
        opacity: 0.6,
        textTransform: 'uppercase',
      }}>{item.category}</div>
      {/* Main pattern */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderPattern()}
      </div>
    </div>
  );
};

const SwingThumbnail = ({ swing, onClick }) => (
  <div onClick={onClick} style={{
    width: '100%', aspectRatio: '3/4',
    background: swing.isPR ? `linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldBright} 100%)` : `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`,
    borderRadius: 10, position: 'relative', overflow: 'hidden', cursor: 'pointer',
    border: `1px solid ${swing.isPR ? brand.gold : brand.border}`,
  }}>
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <Play size={22} color={swing.isPR ? brand.dark : brand.gold} fill={swing.isPR ? brand.dark : brand.gold} strokeWidth={1} style={{ opacity: 0.9 }} />
    </div>
    {swing.isPR && <div style={{ position: 'absolute', top: 4, left: 4, background: brand.dark, color: brand.gold, padding: '2px 5px', borderRadius: 4, fontSize: 7, fontWeight: 800, fontFamily: fonts.display, letterSpacing: 0.5 }}>PR</div>}
    {swing.isFavorite && !swing.isPR && <div style={{ position: 'absolute', top: 4, right: 4 }}><Heart size={10} color={brand.gold} fill={brand.gold} /></div>}
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: swing.isPR ? 'rgba(45,43,42,0.85)' : 'rgba(0,0,0,0.75)', padding: '4px 6px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: brand.gold, fontFamily: fonts.display, letterSpacing: -0.3 }}>
        {swing.exitVelo}<span style={{ fontSize: 8, marginLeft: 1, opacity: 0.7 }}>mph</span>
      </div>
      <div style={{ fontSize: 8, color: swing.isPR ? brand.cream : brand.muted, fontWeight: 600, marginTop: 1, display: 'flex', justifyContent: 'space-between' }}>
        <span>{swing.launchAngle}°</span>
        <span>{swing.distance}ft</span>
      </div>
    </div>
  </div>
);

// ============================================
// HOME
// ============================================
const HomeScreen = ({ navigate }) => {
  const points = demoData.kid.points;
  const nextReward = getNextReward(points);
  const progress = (points / nextReward.pointsCost) * 100;
  const pointsNeeded = nextReward.pointsCost - points;
  const latestSwing = allSwings.find(s => s.isPR) || allSwings[0];
  const nextBooking = demoData.upcomingBookings[0];

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100, background: brand.darkest }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: brand.muted, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>WELCOME BACK</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, fontFamily: fonts.display, letterSpacing: -0.5 }}>JAKE RODRIGUEZ</div>
        </div>
        <div onClick={() => navigate('message-thread')} style={{ width: 40, height: 40, borderRadius: 12, background: brand.darker, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.border}`, position: 'relative', cursor: 'pointer' }}>
          <Bell size={18} color={brand.cream} />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, background: brand.gold }} />
        </div>
      </div>

      <div onClick={() => navigate('earn')} style={{ margin: '0 20px 16px', background: `linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldBright} 100%)`, borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden', cursor: 'pointer', color: brand.dark }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: 70, background: 'rgba(45,43,42,0.08)' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>YOUR POINTS</div>
            <ChevronRight size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
            <div style={{ fontSize: 48, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1, lineHeight: 1 }}>{points}</div>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>/ {nextReward.pointsCost} pts</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Next: {nextReward.name}</span>
              <span>{pointsNeeded} pts away</span>
            </div>
            <div style={{ width: '100%', height: 8, background: 'rgba(45,43,42,0.15)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: brand.dark, borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 20px 20px' }}>
        {[
          { icon: Flame, color: '#FF6B35', label: 'STREAK', value: '14' },
          { icon: Trophy, color: brand.gold, label: 'RANK 11U', value: '#12' },
          { icon: Zap, color: brand.gold, label: 'EXIT VELO', value: '68', unit: 'mph' },
        ].map((s, i) => (
          <div key={i} style={{ background: brand.darker, borderRadius: 14, padding: 12, border: `1px solid ${brand.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <s.icon size={12} color={s.color} />
              <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1 }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display }}>
              {s.value}{s.unit && <span style={{ fontSize: 11, color: brand.muted, marginLeft: 2 }}>{s.unit}</span>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>NEW FROM COACH</SectionLabel>
        <div onClick={() => navigate('message-thread')} style={{ background: brand.darker, borderRadius: 16, padding: 14, border: `1px solid ${brand.borderGold}`, display: 'flex', gap: 12, cursor: 'pointer' }}>
          <div style={{ width: 80, aspectRatio: '3/4', borderRadius: 10, background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.gold}` }}>
            <Play size={22} color={brand.gold} fill={brand.gold} />
            <div style={{ position: 'absolute', top: 4, left: 4, background: brand.gold, color: brand.dark, padding: '2px 5px', borderRadius: 4, fontSize: 7, fontWeight: 800, fontFamily: fonts.display }}>COACH</div>
            <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: brand.white, padding: '1px 4px', borderRadius: 3, fontSize: 7, fontWeight: 700 }}>1:23</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 9, color: brand.gold, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display, marginBottom: 3 }}>SWING ANALYSIS · 2H AGO</div>
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>Quick fix for your stride timing</div>
            <div style={{ fontSize: 10, color: brand.muted, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"Watch this back — I marked up your stride. Focus on frame 4."</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel action="Book more" onActionClick={() => navigate('book')}>UP NEXT</SectionLabel>
        <div onClick={() => navigate('book')} style={{ background: brand.darker, borderRadius: 16, padding: 18, border: `1px solid ${brand.borderGold}`, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, color: brand.gold, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, fontFamily: fonts.display }}>{nextBooking.date} · {nextBooking.time}</div>
              <div style={{ fontSize: 17, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.3 }}>{nextBooking.title.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: brand.muted, marginTop: 4 }}>{nextBooking.cage} · 45 min</div>
            </div>
            <div style={{ background: `${brand.success}22`, color: brand.success, padding: '5px 10px', borderRadius: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>CONFIRMED</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel action="See all" onActionClick={() => navigate('work')}>ASSIGNMENTS · 2 DUE</SectionLabel>
        {demoData.assignments.filter(a => a.status === 'pending').slice(0, 2).map(hw => (
          <div key={hw.id} onClick={() => navigate('assignment-detail', { id: hw.id })} style={{ background: brand.darker, borderRadius: 14, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: `1px solid ${brand.border}` }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={18} color={brand.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{hw.title}</div>
              <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>Due {hw.dueDate} · {hw.duration}</div>
            </div>
            <PointsBadge points={hw.reward} />
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel action="All my videos" onActionClick={() => navigate('work')}>LATEST PERSONAL BEST</SectionLabel>
        <div onClick={() => navigate('swing-detail', { id: latestSwing.id })} style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 20, aspectRatio: '16/10', position: 'relative', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${brand.borderGold}` }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: `${brand.gold}30`, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.gold}` }}>
              <Play size={28} color={brand.gold} fill={brand.gold} strokeWidth={1} />
            </div>
          </div>
          <div style={{ position: 'absolute', top: 14, left: 14, background: brand.gold, color: brand.dark, padding: '4px 10px', borderRadius: 12, fontSize: 9, fontWeight: 800, letterSpacing: 1, fontFamily: fonts.display }}>NEW PR · 68 MPH</div>
          <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, color: brand.white }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: brand.gold, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 4 }}>OCT 18 · SWING 7 OF 28</div>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.3 }}>HITTING W/ COACH MIKE</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MESSAGE THREAD (inline component)
// ============================================
const MessageThreadInline = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 130px)', minHeight: 500 }}>
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${brand.border}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.gold, color: brand.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, fontFamily: fonts.display }}>M</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Coach Mike</div>
          <div style={{ fontSize: 10, color: brand.success, fontWeight: 600 }}>● Online</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
        {messageThread.map((msg, i) => {
          const prevMsg = i > 0 ? messageThread[i - 1] : null;
          const showTimeHeader = !prevMsg || prevMsg.time.split(',')[0] !== msg.time.split(',')[0];
          const fromCoach = msg.from === 'coach';

          return (
            <div key={msg.id}>
              {showTimeHeader && (
                <div style={{ textAlign: 'center', fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, margin: '14px 0 10px' }}>{msg.time.split(',')[0].toUpperCase()}</div>
              )}
              {msg.type === 'text' && (
                <div style={{ display: 'flex', justifyContent: fromCoach ? 'flex-start' : 'flex-end', marginBottom: 6 }}>
                  <div style={{
                    maxWidth: '75%', padding: '9px 13px',
                    borderRadius: 18, fontSize: 13, lineHeight: 1.4,
                    background: fromCoach ? brand.darker : brand.gold,
                    color: fromCoach ? brand.cream : brand.dark,
                    border: fromCoach ? `1px solid ${brand.border}` : 'none',
                  }}>{msg.text}</div>
                </div>
              )}
              {msg.type === 'video' && (
                <div style={{ display: 'flex', justifyContent: fromCoach ? 'flex-start' : 'flex-end', marginBottom: 6 }}>
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 14, aspectRatio: '3/4', position: 'relative', border: `1px solid ${fromCoach ? brand.gold : brand.border}`, overflow: 'hidden', width: 150 }}>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 22, background: `${brand.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.gold}` }}>
                          <Play size={20} color={brand.gold} fill={brand.gold} />
                        </div>
                      </div>
                      <div style={{ position: 'absolute', top: 5, left: 5, background: fromCoach ? brand.gold : brand.dark, color: fromCoach ? brand.dark : brand.gold, padding: '2px 6px', borderRadius: 4, fontSize: 7, fontWeight: 800, fontFamily: fonts.display, letterSpacing: 0.5, border: !fromCoach ? `1px solid ${brand.gold}` : 'none' }}>
                        {fromCoach ? 'COACH' : 'YOU'} · {msg.label}
                      </div>
                      <div style={{ position: 'absolute', bottom: 5, right: 5, background: 'rgba(0,0,0,0.7)', color: brand.white, padding: '1px 5px', borderRadius: 3, fontSize: 8, fontWeight: 700 }}>{msg.duration}</div>
                    </div>
                    {msg.note && (
                      <div style={{ fontSize: 10, color: brand.muted, marginTop: 4, textAlign: fromCoach ? 'left' : 'right', fontStyle: 'italic', paddingLeft: fromCoach ? 4 : 0, paddingRight: fromCoach ? 0 : 4 }}>"{msg.note}"</div>
                    )}
                    {msg.sentBy && (
                      <div style={{ fontSize: 9, color: brand.muted, marginTop: 2, textAlign: 'right' }}>From {msg.sentBy}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${brand.border}`, display: 'flex', gap: 8, alignItems: 'center', background: brand.darker }}>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.darkest, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: `1px solid ${brand.border}` }}>
          <Camera size={14} color={brand.gold} />
        </div>
        <div style={{ flex: 1, background: brand.darkest, borderRadius: 20, padding: '10px 16px', fontSize: 13, color: brand.muted, border: `1px solid ${brand.border}` }}>Message Coach Mike</div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Send size={14} color={brand.dark} />
        </div>
      </div>
    </div>
  );
};

const MessageThreadScreen = ({ goBack }) => (
  <div style={{ height: '100%', background: brand.darkest, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${brand.border}` }}>
      <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.gold, color: brand.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, fontFamily: fonts.display }}>M</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Coach Mike</div>
          <div style={{ fontSize: 10, color: brand.success, fontWeight: 600 }}>● Online</div>
        </div>
      </div>
      <div style={{ width: 24 }} />
    </div>
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <MessageThreadInline />
    </div>
  </div>
);

// ============================================
// WORK — unified: Swings, Assignments, Messages, Homework, Drills
// ============================================
const WorkScreen = ({ navigate }) => {
  const [tab, setTab] = useState('swings');
  const [swingView, setSwingView] = useState('sessions');

  const pendingAssignments = demoData.assignments.filter(a => a.status === 'pending');
  const doneAssignments = demoData.assignments.filter(a => a.status !== 'pending');
  const totalSwings = allSwings.length;
  const prCount = allSwings.filter(s => s.isPR).length;
  const unreadCount = 1;

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100, background: brand.darkest }}>
      <div style={{ padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>FROM COACH</div>
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.8, marginTop: 6 }}>WORK</div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', gap: 4, borderBottom: `1px solid ${brand.border}`, overflowX: 'auto' }}>
        {[
          { id: 'swings', label: 'SWINGS', count: totalSwings },
          { id: 'assignments', label: 'ASSIGN', count: pendingAssignments.length },
          { id: 'messages', label: 'MESSAGES', count: unreadCount, unread: true },
          { id: 'homework', label: 'HW', count: homeworkVideos.length },
          { id: 'drills', label: 'DRILLS', count: demoData.drillLibrary.length },
        ].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 6px', flex: '1 0 auto', minWidth: 65, textAlign: 'center', borderBottom: tab === t.id ? `2px solid ${brand.gold}` : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: tab === t.id ? brand.gold : brand.muted, letterSpacing: 0.8, fontFamily: fonts.display }}>{t.label}</div>
            <div style={{ fontSize: 9, color: t.unread && t.count > 0 ? brand.gold : (tab === t.id ? brand.cream : brand.muted), marginTop: 2, fontWeight: 700 }}>{t.count}{t.unread && t.count > 0 ? ' NEW' : ''}</div>
          </div>
        ))}
      </div>

      {tab === 'swings' && (
        <>
          <div style={{ padding: '16px 20px 12px' }}>
            <div style={{ background: brand.darker, borderRadius: 14, padding: 14, border: `1px solid ${brand.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Total Swings</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.white, marginTop: 3 }}>{totalSwings}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${brand.border}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>PRs</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.gold, marginTop: 3 }}>{prCount}</div>
              </div>
              <div style={{ borderLeft: `1px solid ${brand.border}`, paddingLeft: 14 }}>
                <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Sessions</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.white, marginTop: 3 }}>{sessions.length}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
            <div onClick={() => setSwingView('sessions')} style={{ padding: '6px 12px', borderRadius: 14, background: swingView === 'sessions' ? brand.gold : brand.darker, color: swingView === 'sessions' ? brand.dark : brand.muted, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1, border: `1px solid ${swingView === 'sessions' ? brand.gold : brand.border}` }}>BY SESSION</div>
            <div onClick={() => setSwingView('all')} style={{ padding: '6px 12px', borderRadius: 14, background: swingView === 'all' ? brand.gold : brand.darker, color: swingView === 'all' ? brand.dark : brand.muted, fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1, border: `1px solid ${swingView === 'all' ? brand.gold : brand.border}` }}>ALL SWINGS</div>
          </div>

          {swingView === 'sessions' && (
            <div style={{ padding: '0 20px 20px' }}>
              {sessions.map(session => {
                const sessionSwings = allSwings.filter(s => s.sessionId === session.id).slice(0, 4);
                return (
                  <div key={session.id} style={{ marginBottom: 20 }}>
                    <div onClick={() => navigate('session-detail', { id: session.id })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, cursor: 'pointer' }}>
                      <div>
                        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: fonts.display }}>{session.date} · {session.time}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{session.sessionName}</div>
                        <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{session.swingCount} swings · Avg {session.avgVelo}mph · Best {session.bestVelo}mph</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {session.hasPR && <div style={{ background: brand.gold, color: brand.dark, padding: '2px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800, fontFamily: fonts.display }}>PR</div>}
                        <ChevronRight size={16} color={brand.muted} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {sessionSwings.map(swing => <SwingThumbnail key={swing.id} swing={swing} onClick={() => navigate('swing-detail', { id: swing.id })} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {swingView === 'all' && (
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {allSwings.slice(0, 30).map(swing => <SwingThumbnail key={swing.id} swing={swing} onClick={() => navigate('swing-detail', { id: swing.id })} />)}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'assignments' && (
        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10, fontFamily: fonts.display }}>DUE THIS WEEK · {pendingAssignments.length}</div>
          {pendingAssignments.map(hw => (
            <div key={hw.id} onClick={() => navigate('assignment-detail', { id: hw.id })} style={{ background: brand.darker, borderRadius: 14, padding: 14, marginBottom: 10, cursor: 'pointer', border: `1px solid ${brand.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target size={18} color={brand.gold} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{hw.title}</div>
                  <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{hw.duration} · due {hw.dueDate}</div>
                </div>
                <PointsBadge points={hw.reward} />
              </div>
            </div>
          ))}

          <div style={{ fontSize: 10, color: brand.muted, fontWeight: 700, letterSpacing: 1.5, marginTop: 20, marginBottom: 10, fontFamily: fonts.display }}>COMPLETED</div>
          {doneAssignments.map(hw => (
            <div key={hw.id} style={{ background: brand.darker, borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.success}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={18} color={brand.success} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{hw.title}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{hw.status === 'submitted' ? 'Awaiting review' : 'Reviewed · +25 pts'}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <MessageThreadInline />
      )}

      {tab === 'homework' && (
        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ fontSize: 11, color: brand.muted, marginBottom: 14, lineHeight: 1.5 }}>Your submitted homework videos with coach feedback.</div>
          {homeworkVideos.map(hw => (
            <div key={hw.id} onClick={() => navigate('homework-video-detail', { id: hw.id })} style={{ background: brand.darker, borderRadius: 14, padding: 12, marginBottom: 10, display: 'flex', gap: 12, border: `1px solid ${brand.border}`, cursor: 'pointer' }}>
              <div style={{ width: 100, aspectRatio: '3/4', borderRadius: 10, background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, position: 'relative', flexShrink: 0, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play size={22} color={brand.gold} fill={brand.gold} strokeWidth={1} />
                <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: brand.white, padding: '2px 5px', borderRadius: 4, fontSize: 8, fontWeight: 700 }}>{hw.duration}</div>
                <div style={{ position: 'absolute', top: 4, left: 4, background: brand.success, color: brand.darkest, padding: '2px 5px', borderRadius: 4, fontSize: 7, fontWeight: 800, fontFamily: fonts.display }}>REVIEWED</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4 }}>{hw.title}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginBottom: 8 }}>Submitted {hw.dateSubmitted}</div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(star => <Star key={star} size={10} color={star <= hw.rating ? brand.gold : brand.border} fill={star <= hw.rating ? brand.gold : 'none'} />)}
                </div>
                <div style={{ fontSize: 10, color: brand.cream, marginTop: 8, lineHeight: 1.4, fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>"{hw.coachNote}"</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'drills' && (
        <div style={{ padding: '16px 20px 20px' }}>
          <div style={{ fontSize: 11, color: brand.muted, marginBottom: 14, lineHeight: 1.5 }}>Training drills you can do anytime, anywhere.</div>
          {demoData.drillLibrary.map(v => (
            <div key={v.id} onClick={() => navigate('video-player')} style={{ background: brand.darker, borderRadius: 14, padding: 12, marginBottom: 10, display: 'flex', gap: 12, border: `1px solid ${brand.border}`, cursor: 'pointer' }}>
              <div style={{ width: 80, height: 60, borderRadius: 10, background: brand.dark, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.border}` }}>
                <Play size={22} color={brand.gold} fill={brand.gold} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{v.title}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginTop: 4 }}>{v.duration} · {v.category} · {v.level}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// SESSION DETAIL
// ============================================
const SessionDetailScreen = ({ navigate, goBack, params }) => {
  const session = sessions.find(s => s.id === (params?.id || 1)) || sessions[0];
  const sessionSwings = allSwings.filter(s => s.sessionId === session.id);

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 40, background: brand.darkest }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <Share2 size={20} color={brand.gold} />
      </div>

      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{session.date} · {session.time}</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 6 }}>{session.sessionName.toUpperCase()}</div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: brand.darker, borderRadius: 16, padding: 16, border: `1px solid ${brand.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Swings', value: session.swingCount },
            { label: 'Avg', value: session.avgVelo, unit: 'mph' },
            { label: 'Best', value: session.bestVelo, unit: 'mph', gold: true },
            { label: 'PRs', value: sessionSwings.filter(s => s.isPR).length, gold: true },
          ].map((s, i) => (
            <div key={i} style={{ borderLeft: i > 0 ? `1px solid ${brand.border}` : 'none', paddingLeft: i > 0 ? 12 : 0 }}>
              <div style={{ fontSize: 8, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: s.gold ? brand.gold : brand.white, marginTop: 3 }}>
                {s.value}{s.unit && <span style={{ fontSize: 9, color: brand.muted }}>{s.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>ALL {session.swingCount} SWINGS</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {sessionSwings.map(swing => <SwingThumbnail key={swing.id} swing={swing} onClick={() => navigate('swing-detail', { id: swing.id })} />)}
        </div>
      </div>
    </div>
  );
};

// ============================================
// SWING DETAIL
// ============================================
const SwingDetailScreen = ({ navigate, goBack, params }) => {
  const swing = allSwings.find(s => s.id === (params?.id || 7)) || allSwings[6];
  const [isFav, setIsFav] = useState(swing.isFavorite);

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 40, background: brand.darkest }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div onClick={() => setIsFav(!isFav)} style={{ cursor: 'pointer' }}>
            <Heart size={20} color={brand.gold} fill={isFav ? brand.gold : 'none'} />
          </div>
          <div onClick={() => navigate('share-card', { swingId: swing.id })} style={{ cursor: 'pointer' }}>
            <Share2 size={20} color={brand.gold} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 20, aspectRatio: '16/9', position: 'relative', border: `1px solid ${swing.isPR ? brand.gold : brand.borderGold}`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: 34, background: `${brand.gold}30`, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.gold}` }}>
              <Play size={32} color={brand.gold} fill={brand.gold} strokeWidth={1} />
            </div>
          </div>
          {swing.isPR && (
            <div style={{ position: 'absolute', top: 12, left: 12, background: brand.gold, color: brand.dark, padding: '5px 12px', borderRadius: 10, fontSize: 10, fontWeight: 800, fontFamily: fonts.display, letterSpacing: 1 }}>PERSONAL BEST</div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 24px 8px' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{swing.session.date} · {swing.session.time}</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 4 }}>{swing.session.sessionName.toUpperCase()}</div>
      </div>

      <div style={{ padding: '16px 20px 20px' }}>
        <SectionLabel>SWING METRICS</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Exit Velocity', value: swing.exitVelo, unit: 'mph', isPB: swing.isPR, delta: swing.isPR ? 'New PR!' : `${swing.exitVelo > 65 ? '+' : ''}${swing.exitVelo - 65} vs avg` },
            { label: 'Launch Angle', value: swing.launchAngle, unit: '°', delta: swing.launchAngle >= 10 && swing.launchAngle <= 25 ? 'Optimal' : 'Adjust' },
            { label: 'Distance', value: swing.distance, unit: 'ft', isPB: swing.isPR, delta: swing.result },
            { label: 'Contact', value: swing.isContact ? 'Clean' : 'Off', unit: '', delta: swing.isContact ? 'Hard hit' : 'Try again' },
          ].map((m, i) => (
            <div key={i} style={{ background: brand.darker, borderRadius: 14, padding: 14, border: `1px solid ${m.isPB ? brand.borderGold : brand.border}`, position: 'relative' }}>
              {m.isPB && <div style={{ position: 'absolute', top: 8, right: 8, background: brand.gold, color: brand.dark, padding: '2px 6px', borderRadius: 6, fontSize: 8, fontWeight: 800, fontFamily: fonts.display }}>PR</div>}
              <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 8 }}>
                <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: m.isPB ? brand.gold : brand.white, letterSpacing: -1 }}>{m.value}</div>
                <div style={{ fontSize: 10, color: brand.muted, fontWeight: 600 }}>{m.unit}</div>
              </div>
              <div style={{ fontSize: 10, color: m.isPB ? brand.gold : brand.muted, fontWeight: 700, marginTop: 4 }}>{m.delta}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
        <div onClick={() => navigate('share-card', { swingId: swing.id })} style={{ flex: 1, background: brand.darker, border: `1px solid ${brand.gold}`, color: brand.gold, padding: 14, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontFamily: fonts.display, letterSpacing: 1 }}>
          <Share2 size={14} /> SHARE
        </div>
        <div onClick={() => navigate('work')} style={{ flex: 1, background: brand.gold, color: brand.dark, padding: 14, borderRadius: 12, textAlign: 'center', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontFamily: fonts.display, letterSpacing: 1 }}>
          <Send size={14} /> SEND TO COACH
        </div>
      </div>

      {swing.isPR && (
        <div style={{ padding: '0 20px 20px' }}>
          <SectionLabel>COACH MIKE'S NOTE</SectionLabel>
          <div style={{ background: `linear-gradient(135deg, ${brand.darker} 0%, ${brand.dark} 100%)`, borderRadius: 16, padding: 16, border: `1px solid ${brand.borderGold}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', color: brand.dark, fontWeight: 800, fontSize: 13, fontFamily: fonts.display }}>M</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Coach Mike</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: brand.cream }}>"Real rotation here — hands stayed inside the ball, lower half was explosive. Keep this feel."</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// SHARE CARD
// ============================================
const ShareCardScreen = ({ goBack, params }) => {
  const swing = allSwings.find(s => s.id === (params?.swingId || 7)) || allSwings[6];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: brand.darkest, paddingBottom: 20 }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1 }}>SHARE</div>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ padding: '20px 50px 20px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 220, aspectRatio: '9/16',
          background: `linear-gradient(160deg, ${brand.dark} 0%, ${brand.darker} 50%, ${brand.darkest} 100%)`,
          borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          color: brand.cream, border: `1px solid ${brand.borderGold}`,
          boxShadow: `0 10px 40px rgba(241, 229, 173, 0.15)`,
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${brand.gold}, transparent)` }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${brand.gold}, transparent)` }} />

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 7, color: brand.gold, fontWeight: 800, letterSpacing: 3, fontFamily: fonts.display }}>INFINITE HITTING</div>
            <div style={{ fontSize: 5, color: brand.muted, letterSpacing: 2, marginTop: 2, fontFamily: fonts.display }}>CLUBHOUSE · DALLAS N.</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: brand.gold, fontWeight: 800, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 4 }}>NEW PERSONAL BEST</div>
            <div style={{ fontSize: 80, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -4, lineHeight: 0.85, color: brand.gold }}>{swing.exitVelo}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: brand.white, fontFamily: fonts.display, letterSpacing: 1, marginTop: 4 }}>MPH EXIT VELO</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: brand.white, fontFamily: fonts.display, letterSpacing: 0.5 }}>JAKE RODRIGUEZ</div>
            <div style={{ fontSize: 7, color: brand.muted, marginTop: 2, fontFamily: fonts.display, letterSpacing: 1 }}>11U · {swing.session.date}</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>SHARE TO</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Instagram', icon: Instagram },
            { label: 'TikTok', icon: Video },
            { label: 'Message', icon: MessageCircle },
            { label: 'More', icon: Share2 },
          ].map(opt => (
            <div key={opt.label} style={{ background: brand.darker, borderRadius: 14, padding: 12, textAlign: 'center', border: `1px solid ${brand.border}`, cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${brand.gold}15`, margin: '0 auto 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <opt.icon size={18} color={brand.gold} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5 }}>{opt.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// HOMEWORK VIDEO DETAIL
// ============================================
const HomeworkVideoDetailScreen = ({ goBack, params }) => {
  const hw = homeworkVideos.find(h => h.id === (params?.id || 1)) || homeworkVideos[0];
  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 40, background: brand.darkest }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <Share2 size={20} color={brand.gold} />
      </div>

      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>SUBMITTED {hw.dateSubmitted}</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 6, lineHeight: 1.15 }}>{hw.title.toUpperCase()}</div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>SIDE BY SIDE</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['YOU', 'COACH'].map((side, idx) => (
            <div key={side}>
              <div style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 12, aspectRatio: '3/4', position: 'relative', border: `1px solid ${idx === 0 ? brand.gold : brand.border}`, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Play size={28} color={brand.gold} fill={brand.gold} />
                </div>
                <div style={{ position: 'absolute', top: 6, left: 6, background: idx === 0 ? brand.gold : brand.dark, color: idx === 0 ? brand.dark : brand.gold, padding: '3px 6px', borderRadius: 5, fontSize: 8, fontWeight: 800, fontFamily: fonts.display, border: idx === 1 ? `1px solid ${brand.gold}` : 'none' }}>{side}</div>
              </div>
              <div style={{ fontSize: 10, color: brand.muted, textAlign: 'center', marginTop: 6, fontWeight: 700, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>{idx === 0 ? 'YOUR ATTEMPT' : 'DEMO'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: brand.darker, borderRadius: 14, padding: 16, border: `1px solid ${brand.border}` }}>
          <div style={{ fontSize: 10, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>COACH RATING</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(star => <Star key={star} size={24} color={star <= hw.rating ? brand.gold : brand.border} fill={star <= hw.rating ? brand.gold : 'none'} />)}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>COACH MIKE'S FEEDBACK</SectionLabel>
        <div style={{ background: `linear-gradient(135deg, ${brand.darker} 0%, ${brand.dark} 100%)`, borderRadius: 16, padding: 16, border: `1px solid ${brand.borderGold}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', color: brand.dark, fontWeight: 800, fontSize: 13, fontFamily: fonts.display }}>M</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Coach Mike</div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: brand.cream, fontStyle: 'italic' }}>"{hw.coachNote}"</div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ASSIGNMENT DETAIL + RECORD
// ============================================
const AssignmentDetailScreen = ({ navigate, goBack, params }) => {
  const hw = demoData.assignments.find(a => a.id === (params?.id || 1)) || demoData.assignments[0];
  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 120, background: brand.darkest }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ fontSize: 10, fontWeight: 800, color: brand.gold, background: `${brand.gold}15`, padding: '5px 10px', borderRadius: 12, letterSpacing: 1, fontFamily: fonts.display, border: `1px solid ${brand.borderGold}` }}>DUE {hw.dueDate.toUpperCase()}</div>
      </div>
      <div style={{ padding: '8px 20px 16px' }}>
        <div style={{ fontSize: 10, color: brand.muted, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 8 }}>ASSIGNMENT</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.8, lineHeight: 1.1 }}>{hw.title.toUpperCase()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <div style={{ fontSize: 12, color: brand.muted }}>{hw.assignedBy} · {hw.duration}</div>
          <PointsBadge points={hw.reward} size="lg" />
        </div>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>WATCH THE DRILL</SectionLabel>
        <div style={{ background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 16, aspectRatio: '16/9', position: 'relative', border: `1px solid ${brand.borderGold}`, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 30, background: `${brand.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.gold}` }}>
              <Play size={28} color={brand.gold} fill={brand.gold} />
            </div>
          </div>
          <div style={{ position: 'absolute', top: 10, left: 10, background: brand.gold, color: brand.dark, padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 800, fontFamily: fonts.display }}>COACH DEMO</div>
        </div>
      </div>
      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>WHAT TO DO</SectionLabel>
        <div style={{ background: brand.darker, borderRadius: 16, padding: 16, border: `1px solid ${brand.border}` }}>
          {['20 reps on tee, inside pitch setup', 'Drive hands to the ball', 'Record 5 swings from front angle', 'Aim for 65+ mph exit velo'].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < 3 ? `1px solid ${brand.border}` : 'none' }}>
              <div style={{ width: 24, height: 24, borderRadius: 12, background: `${brand.gold}22`, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, fontFamily: fonts.display }}>{i + 1}</div>
              <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, color: brand.cream }}>{step}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
        <div onClick={() => navigate('assignment-record')} style={{ background: brand.gold, color: brand.dark, padding: '18px', borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontFamily: fonts.display, letterSpacing: 1 }}>
          <Camera size={18} />
          RECORD YOUR ATTEMPT
        </div>
      </div>
    </div>
  );
};

const RecordAssignmentScreen = ({ navigate, goBack }) => {
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (submitted) {
      const t = setTimeout(() => navigate('home'), 3000);
      return () => clearTimeout(t);
    }
  }, [submitted]);

  if (submitted) {
    return (
      <div style={{ height: '100%', background: brand.darkest, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: 100, height: 100, borderRadius: 50, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: `2px solid ${brand.gold}` }}>
          <Check size={48} color={brand.gold} strokeWidth={3} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, fontFamily: fonts.display, letterSpacing: -0.5 }}>NICE WORK.</div>
        <div style={{ fontSize: 14, color: brand.muted, textAlign: 'center', marginBottom: 24, maxWidth: 300 }}>Coach Mike will review. Saved to Work → Homework.</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>+25</div>
          <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1.5, fontFamily: fonts.display }}>POINTS</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: brand.darkest, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1 }}>RECORD</div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ flex: 1, background: '#000', margin: '0 20px', borderRadius: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: `1px solid ${brand.borderGold}` }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${brand.darker}, ${brand.dark})` }} />
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <Camera size={56} color="rgba(241, 229, 173, 0.4)" strokeWidth={1.5} />
          <div style={{ fontSize: 12, color: brand.muted, marginTop: 12, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, fontWeight: 700 }}>CAMERA PREVIEW</div>
        </div>
        <div style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(200, 107, 92, 0.95)', padding: '4px 10px', borderRadius: 10, fontSize: 10, fontWeight: 800, color: brand.white, display: 'flex', alignItems: 'center', gap: 5, fontFamily: fonts.display, letterSpacing: 1 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: brand.white }} /> REC 00:12
        </div>
      </div>
      <div style={{ padding: 24, display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'center' }}>
        <div onClick={() => setSubmitted(true)} style={{ width: 74, height: 74, borderRadius: 37, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 0 4px ${brand.darkest}, 0 0 0 6px ${brand.gold}` }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.dark }} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// BOOK
// ============================================
const BookScreen = ({ navigate }) => {
  const [typeFilter, setTypeFilter] = useState('all');

  const filterSlots = (slots) => typeFilter === 'all' ? slots : slots.filter(s => s.type === typeFilter);

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100, background: brand.darkest }}>
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>RESERVE YOUR SPOT</div>
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.8, marginTop: 6 }}>BOOK</div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'private', label: 'Private Lessons' },
          { id: 'group', label: 'Group Classes' },
          { id: 'cage', label: 'Cage Rental' },
        ].map(t => (
          <div key={t.id} onClick={() => setTypeFilter(t.id)} style={{
            padding: '8px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800,
            background: typeFilter === t.id ? brand.gold : brand.darker,
            color: typeFilter === t.id ? brand.dark : brand.muted,
            border: `1px solid ${typeFilter === t.id ? brand.gold : brand.border}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: fonts.display, letterSpacing: 0.8, textTransform: 'uppercase',
          }}>{t.label}</div>
        ))}
      </div>

      {typeFilter === 'all' && (
        <div style={{ padding: '0 20px 20px' }}>
          <SectionLabel>WHAT CAN I BOOK?</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {demoData.bookingTypes.map(bt => {
              const Icon = bt.icon === 'user' ? User : bt.icon === 'users' ? UsersIcon : Hash;
              return (
                <div key={bt.id} onClick={() => setTypeFilter(bt.id)} style={{ background: brand.darker, borderRadius: 12, padding: 12, border: `1px solid ${brand.border}`, cursor: 'pointer' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${brand.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <Icon size={14} color={brand.gold} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: brand.cream }}>{bt.label}</div>
                  <div style={{ fontSize: 9, color: brand.muted, marginTop: 2, lineHeight: 1.3 }}>{bt.duration}</div>
                  <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, marginTop: 4, fontFamily: fonts.display }}>{bt.priceRange}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>YOUR UPCOMING</SectionLabel>
        {demoData.upcomingBookings.map(b => (
          <div key={b.id} style={{ background: `linear-gradient(135deg, ${brand.gold}15 0%, ${brand.darker} 100%)`, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${brand.borderGold}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: brand.gold, color: brand.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, fontFamily: fonts.display }}>{b.date.substring(0, 3).toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: fonts.display }}>{b.time.split(' ')[0]}</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.title}</div>
              <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{b.cage} · {b.time}</div>
            </div>
            <div style={{ background: `${brand.success}22`, color: brand.success, padding: '4px 8px', borderRadius: 12, fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>CONFIRMED</div>
          </div>
        ))}
      </div>

      {demoData.bookingSlots.map(day => {
        const daySlots = filterSlots(day.slots);
        if (daySlots.length === 0) return null;
        return (
          <div key={day.id} style={{ padding: '0 20px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 1.5, fontFamily: fonts.display }}>{day.date.toUpperCase()}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{day.dayLabel}</div>
              </div>
              <div style={{ fontSize: 10, color: brand.muted, fontWeight: 600 }}>{daySlots.filter(s => s.available).length} open</div>
            </div>
            {daySlots.map((slot, i) => {
              const available = slot.available;
              const isPrivate = slot.type === 'private';
              const isGroup = slot.type === 'group';
              return (
                <div key={i} onClick={() => available && navigate('book-confirm', { slot, date: day.dayLabel })} style={{ background: available ? brand.darker : brand.darkest, borderRadius: 12, padding: 12, marginBottom: 6, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 12, opacity: available ? 1 : 0.4, cursor: available ? 'pointer' : 'not-allowed' }}>
                  <div style={{ width: 60, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, fontFamily: fonts.display, color: brand.cream }}>{slot.time}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{slot.coach}</div>
                    <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{slot.cage}</div>
                  </div>
                  <div style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 800, letterSpacing: 0.5, fontFamily: fonts.display,
                    background: isPrivate ? `${brand.gold}22` : isGroup ? `${brand.success}22` : `${brand.info}22`,
                    color: isPrivate ? brand.gold : isGroup ? brand.success : brand.info,
                  }}>{slot.type.toUpperCase()}</div>
                  {available ? <ChevronRight size={14} color={brand.muted} /> : <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700 }}>FULL</div>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const BookConfirmScreen = ({ navigate, goBack, params }) => {
  const [confirmed, setConfirmed] = useState(false);
  const slot = params?.slot || { time: '5:00 PM', coach: 'Coach Mike', cage: 'Cage 3', type: 'private' };
  const date = params?.date || 'Wed, Oct 23';

  useEffect(() => {
    if (confirmed) {
      const t = setTimeout(() => navigate('book'), 2500);
      return () => clearTimeout(t);
    }
  }, [confirmed]);

  if (confirmed) {
    return (
      <div style={{ height: '100%', background: brand.darkest, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: 100, height: 100, borderRadius: 50, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: `2px solid ${brand.gold}` }}>
          <Check size={48} color={brand.gold} strokeWidth={3} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, fontFamily: fonts.display, letterSpacing: -0.5 }}>BOOKED!</div>
        <div style={{ fontSize: 14, color: brand.muted, textAlign: 'center', maxWidth: 300 }}>{date} · {slot.time} · {slot.coach}</div>
        <div style={{ fontSize: 11, color: brand.gold, marginTop: 10, fontWeight: 700 }}>You'll get a reminder 1 hour before.</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: brand.darkest, overflow: 'auto', paddingBottom: 120 }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1 }}>CONFIRM BOOKING</div>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 16, background: brand.gold, color: brand.dark, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Calendar size={36} strokeWidth={2} />
        </div>
        <div style={{ fontSize: 11, color: brand.muted, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{slot.type.toUpperCase()} SESSION</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.3, marginTop: 6 }}>{slot.coach.toUpperCase()}</div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: brand.darker, borderRadius: 16, padding: 20, border: `1px solid ${brand.border}` }}>
          {[
            { label: 'Date', value: date },
            { label: 'Time', value: slot.time },
            { label: 'Duration', value: '45 minutes' },
            { label: 'Cage', value: slot.cage },
            { label: 'Athlete', value: 'Jake Rodriguez (11U)' },
          ].map((row, i, arr) => (
            <div key={i} style={{ padding: '10px 0', display: 'flex', justifyContent: 'space-between', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
              <div style={{ fontSize: 12, color: brand.muted }}>{row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: `${brand.success}15`, borderRadius: 12, padding: 14, border: `1px solid ${brand.success}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Check size={18} color={brand.success} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: brand.success }}>Included with Unlimited Monthly</div>
            <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>No additional charge.</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
        <div onClick={() => setConfirmed(true)} style={{ background: brand.gold, color: brand.dark, padding: 18, borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1 }}>CONFIRM BOOKING</div>
      </div>
    </div>
  );
};

// ============================================
// EARN — Rewards + Store + Ranks + Earn
// ============================================
const EarnScreen = ({ navigate }) => {
  const [tab, setTab] = useState('rewards');
  const points = demoData.kid.points;

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100, background: brand.darkest }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ background: `linear-gradient(135deg, ${brand.gold} 0%, ${brand.goldBright} 100%)`, borderRadius: 20, padding: 20, color: brand.dark, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, background: 'rgba(45,43,42,0.06)' }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>YOUR POINTS</div>
                <div style={{ fontSize: 44, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1, lineHeight: 1, marginTop: 4 }}>{points}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, fontFamily: fonts.display, opacity: 0.7 }}>YOUR RANK</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 4 }}>#12</div>
                <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.7, marginTop: 2 }}>in 11U</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 20px 0', display: 'flex', gap: 8 }}>
        {[
          { id: 'rewards', label: 'Rewards' },
          { id: 'store', label: 'Store' },
          { id: 'ranks', label: 'Ranks' },
          { id: 'earn', label: 'Earn' },
        ].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: 'pointer',
            background: tab === t.id ? brand.gold : brand.darker,
            color: tab === t.id ? brand.dark : brand.muted,
            border: `1px solid ${tab === t.id ? brand.gold : brand.border}`,
            fontFamily: fonts.display, letterSpacing: 1, textTransform: 'uppercase',
          }}>{t.label}</div>
        ))}
      </div>

      {tab === 'rewards' && (
        <div style={{ padding: '20px 20px' }}>
          <SectionLabel>CLOSEST TO UNLOCKING</SectionLabel>
          {demoData.rewards.sort((a, b) => a.pointsCost - b.pointsCost).map(reward => {
            const canRedeem = points >= reward.pointsCost;
            const progress = Math.min((points / reward.pointsCost) * 100, 100);
            const needed = Math.max(reward.pointsCost - points, 0);
            const iconMap = { shirt: ShoppingBag, session: Calendar, bat: Dumbbell, hoodie: ShoppingBag, gloves: Target, camp: Trophy, cap: ShoppingBag, helmet: Target };
            const Icon = iconMap[reward.icon] || ShoppingBag;
            return (
              <div key={reward.id} onClick={() => canRedeem && navigate('reward-redeem', { id: reward.id })} style={{ background: brand.darker, borderRadius: 16, padding: 16, marginBottom: 10, border: `1px solid ${canRedeem ? brand.gold : brand.border}`, cursor: canRedeem ? 'pointer' : 'default', opacity: canRedeem ? 1 : 0.85 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ width: 54, height: 54, borderRadius: 12, background: canRedeem ? brand.gold : brand.dark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color={canRedeem ? brand.dark : brand.gold} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{reward.category}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{reward.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>{reward.pointsCost}</div>
                    <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700 }}>PTS</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: canRedeem ? brand.gold : brand.muted }}>{canRedeem ? 'READY TO REDEEM' : `${needed} PTS AWAY`}</span>
                    <span style={{ color: brand.muted }}>or <strong style={{ color: brand.cream }}>${reward.dollarPrice}</strong> in Store</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: brand.dark, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: canRedeem ? brand.gold : brand.goldBright, borderRadius: 3 }} />
                  </div>
                </div>
                {canRedeem && (
                  <div style={{ marginTop: 12, padding: '10px', background: brand.gold, color: brand.dark, borderRadius: 10, textAlign: 'center', fontSize: 12, fontWeight: 800, fontFamily: fonts.display, letterSpacing: 1 }}>REDEEM NOW →</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'store' && (
        <div style={{ padding: '20px 20px' }}>
          <div style={{ background: `${brand.info}15`, border: `1px solid ${brand.info}40`, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 11, color: brand.cream, lineHeight: 1.5 }}>
            <strong style={{ color: brand.info }}>Can't wait to earn points?</strong> Buy apparel and equipment directly. Every item also available via points.
          </div>

          <SectionLabel>APPAREL & GEAR</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {demoData.rewards.map(item => {
              return (
                <div key={item.id} onClick={() => navigate('store-item', { id: item.id })} style={{ background: brand.darker, borderRadius: 14, padding: 12, border: `1px solid ${brand.border}`, cursor: 'pointer' }}>
                  <div style={{ marginBottom: 10 }}>
                    <ProductVisual item={item} size="sm" />
                  </div>
                  <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{item.category}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, lineHeight: 1.3 }}>{item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: brand.cream, fontFamily: fonts.display }}>${item.dollarPrice}</div>
                    <div style={{ fontSize: 9, color: brand.gold, fontWeight: 700, fontFamily: fonts.display }}>or {item.pointsCost} pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'ranks' && (
        <div style={{ padding: '20px 20px' }}>
          <SectionLabel>11U · EXIT VELO</SectionLabel>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
            {[demoData.leaderboard[1], demoData.leaderboard[0], demoData.leaderboard[2]].map((p, i) => {
              const height = i === 1 ? 110 : i === 0 ? 82 : 72;
              const isFirst = i === 1;
              return (
                <div key={p.rank} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ width: 54, height: 54, borderRadius: 27, margin: '0 auto 8px', background: isFirst ? brand.gold : brand.darker, border: `2px solid ${isFirst ? brand.gold : brand.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: isFirst ? brand.dark : brand.white, fontFamily: fonts.display }}>{p.name.charAt(0)}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{p.name.split(' ')[0]}</div>
                  <div style={{ height, background: isFirst ? brand.gold : brand.darker, border: `1px solid ${isFirst ? brand.gold : brand.border}`, borderRadius: '10px 10px 0 0', marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isFirst ? brand.dark : brand.white, fontFamily: fonts.display }}>{p.rank}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: isFirst ? brand.dark : brand.gold, fontFamily: fonts.display, marginTop: 2 }}>{p.value} mph</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: `linear-gradient(135deg, ${brand.gold}22 0%, ${brand.goldBright}22 100%)`, borderRadius: 14, padding: 14, border: `1px solid ${brand.gold}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: brand.gold, color: brand.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, fontFamily: fonts.display }}>J</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>You're #12 in the nation</div>
              <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>68 mph · up 3 spots this week</div>
            </div>
            <div style={{ fontSize: 14, color: brand.success, fontWeight: 700, fontFamily: fonts.display }}>+3 ↑</div>
          </div>

          <SectionLabel>TOP 25</SectionLabel>
          {demoData.leaderboard.slice(3).map(p => (
            <div key={p.rank} style={{ padding: '12px 14px', background: p.isYou ? `${brand.gold}15` : brand.darker, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, border: `1px solid ${p.isYou ? brand.gold : brand.border}` }}>
              <div style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 700, color: p.isYou ? brand.gold : brand.muted, fontFamily: fonts.display }}>{p.rank}</div>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: p.isYou ? brand.gold : brand.dark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: p.isYou ? brand.dark : brand.white, fontFamily: fonts.display }}>{p.name.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}{p.isYou && ' (You)'}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{p.location}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: fonts.display, color: p.isYou ? brand.gold : brand.white }}>{p.value} mph</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'earn' && (
        <div style={{ padding: '20px 20px' }}>
          <SectionLabel>HOW TO EARN POINTS</SectionLabel>
          <div style={{ background: brand.darker, borderRadius: 16, border: `1px solid ${brand.border}`, overflow: 'hidden', marginBottom: 20 }}>
            {demoData.earningRules.map((rule, i, arr) => {
              const IconComp = { check: Check, target: Target, trophy: Trophy, flame: Flame, award: Award, gift: Gift }[rule.icon];
              return (
                <div key={i} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${brand.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {IconComp && <IconComp size={16} color={brand.gold} />}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: brand.cream }}>{rule.action}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>+{rule.points}</div>
                </div>
              );
            })}
          </div>

          <SectionLabel>RECENT EARNINGS</SectionLabel>
          {demoData.pointsActivity.map((activity, i) => (
            <div key={i} style={{ background: brand.darker, borderRadius: 12, padding: 14, marginBottom: 8, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: brand.gold }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{activity.action}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{activity.date}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>+{activity.points}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// STORE ITEM + REWARD REDEEM
// ============================================
const StoreItemScreen = ({ goBack, navigate, params }) => {
  const item = demoData.rewards.find(r => r.id === (params?.id || 1)) || demoData.rewards[0];
  const [purchased, setPurchased] = useState(false);
  const [method, setMethod] = useState('card');
  const canUsePoints = demoData.kid.points >= item.pointsCost;

  useEffect(() => {
    if (purchased) {
      const t = setTimeout(() => navigate('earn'), 2500);
      return () => clearTimeout(t);
    }
  }, [purchased]);

  if (purchased) {
    return (
      <div style={{ height: '100%', background: brand.darkest, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ width: 100, height: 100, borderRadius: 50, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: `2px solid ${brand.gold}` }}>
          <Check size={48} color={brand.gold} strokeWidth={3} />
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8, fontFamily: fonts.display, letterSpacing: -0.5 }}>ORDERED!</div>
        <div style={{ fontSize: 13, color: brand.muted, textAlign: 'center', maxWidth: 300 }}>Pick up at the front desk next visit.</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: brand.darkest, overflow: 'auto', paddingBottom: 120 }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <ShoppingCart size={22} color={brand.gold} />
      </div>

      <div style={{ padding: '0 40px 20px' }}>
        <ProductVisual item={item} size="lg" />
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ fontSize: 11, color: brand.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{item.category}</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 6 }}>{item.name.toUpperCase()}</div>
        <div style={{ fontSize: 13, color: brand.muted, marginTop: 10, lineHeight: 1.5 }}>{item.description}</div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <SectionLabel>CHOOSE HOW TO PAY</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div onClick={() => setMethod('card')} style={{
            background: method === 'card' ? `${brand.gold}15` : brand.darker,
            borderRadius: 14, padding: 16,
            border: `2px solid ${method === 'card' ? brand.gold : brand.border}`,
            cursor: 'pointer',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CreditCard size={14} color={method === 'card' ? brand.gold : brand.muted} />
              <div style={{ fontSize: 10, fontWeight: 800, color: method === 'card' ? brand.gold : brand.muted, letterSpacing: 1, fontFamily: fonts.display }}>CREDIT CARD</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1 }}>${item.dollarPrice}</div>
            <div style={{ fontSize: 10, color: brand.muted, marginTop: 4 }}>Charge to parent on file</div>
          </div>

          <div onClick={() => canUsePoints && setMethod('points')} style={{
            background: method === 'points' ? `${brand.gold}15` : brand.darker,
            borderRadius: 14, padding: 16,
            border: `2px solid ${method === 'points' ? brand.gold : brand.border}`,
            cursor: canUsePoints ? 'pointer' : 'not-allowed',
            opacity: canUsePoints ? 1 : 0.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Sparkles size={14} color={method === 'points' ? brand.gold : brand.muted} />
              <div style={{ fontSize: 10, fontWeight: 800, color: method === 'points' ? brand.gold : brand.muted, letterSpacing: 1, fontFamily: fonts.display }}>POINTS</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1, color: canUsePoints ? brand.gold : brand.muted }}>{item.pointsCost}</div>
            <div style={{ fontSize: 10, color: brand.muted, marginTop: 4 }}>
              {canUsePoints ? `You have ${demoData.kid.points} pts` : `Need ${item.pointsCost - demoData.kid.points} more pts`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ background: `${brand.success}15`, borderRadius: 12, padding: 14, border: `1px solid ${brand.success}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <MapPin size={16} color={brand.success} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: brand.success }}>Pick up at Dallas N. front desk</div>
            <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>Ready in 24–48 hours</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
        <div onClick={() => setPurchased(true)} style={{ background: brand.gold, color: brand.dark, padding: 18, borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1 }}>
          {method === 'card' ? `BUY NOW · $${item.dollarPrice}` : `REDEEM · ${item.pointsCost} PTS`}
        </div>
      </div>
    </div>
  );
};

const RewardRedeemScreen = ({ navigate, goBack, params }) => {
  const [step, setStep] = useState('confirm');
  const reward = demoData.rewards.find(r => r.id === (params?.id || 1)) || demoData.rewards[0];

  if (step === 'code') {
    return (
      <div style={{ height: '100%', background: brand.darkest, overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ChevronLeft size={24} color={brand.white} onClick={() => navigate('home')} style={{ cursor: 'pointer' }} />
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1 }}>REDEMPTION</div>
          <div style={{ width: 24 }} />
        </div>
        <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: 40, background: `${brand.gold}22`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${brand.gold}` }}>
            <Check size={36} color={brand.gold} strokeWidth={3} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>REDEEMED!</div>
          <div style={{ fontSize: 12, color: brand.muted, marginTop: 6 }}>Show this at the front desk.</div>
        </div>
        <div style={{ padding: '28px 40px 20px' }}>
          <div style={{ background: brand.white, borderRadius: 20, padding: 28, textAlign: 'center' }}>
            <div style={{ width: 200, height: 200, margin: '0 auto', background: brand.white, position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)', gap: 1 }}>
              {Array.from({ length: 225 }).map((_, i) => <div key={i} style={{ background: Math.random() > 0.55 ? brand.dark : brand.white }} />)}
              <div style={{ position: 'absolute', top: 0, left: 0, width: 50, height: 50, border: `7px solid ${brand.dark}`, background: brand.white }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 50, height: 50, border: `7px solid ${brand.dark}`, background: brand.white }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: 50, height: 50, border: `7px solid ${brand.dark}`, background: brand.white }} />
            </div>
            <div style={{ marginTop: 20, fontSize: 24, fontWeight: 700, color: brand.dark, fontFamily: fonts.mono, letterSpacing: 4 }}>IH-7F4K-92B</div>
            <div style={{ fontSize: 10, color: brand.muted, marginTop: 4, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Redemption Code</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: brand.darkest, overflow: 'auto', paddingBottom: 100 }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 1 }}>CONFIRM</div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ padding: '20px 20px 0', textAlign: 'center' }}>
        <div style={{ width: 100, height: 100, borderRadius: 20, background: brand.gold, margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingBag size={44} color={brand.dark} strokeWidth={1.5} />
        </div>
        <div style={{ fontSize: 11, color: brand.muted, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>{reward.category}</div>
        <div style={{ fontSize: 24, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 6 }}>{reward.name.toUpperCase()}</div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <div style={{ background: brand.darker, borderRadius: 16, padding: 20, border: `1px solid ${brand.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 14px', borderBottom: `1px solid ${brand.border}` }}>
            <div style={{ fontSize: 12, color: brand.muted, fontWeight: 600 }}>Your points</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display }}>{demoData.kid.points}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${brand.border}` }}>
            <div style={{ fontSize: 12, color: brand.muted, fontWeight: 600 }}>Reward cost</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.danger }}>-{reward.pointsCost}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Balance after</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>{demoData.kid.points - reward.pointsCost}</div>
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 20, left: 20, right: 20 }}>
        <div onClick={() => setStep('code')} style={{ background: brand.gold, color: brand.dark, padding: 18, borderRadius: 14, textAlign: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1 }}>CONFIRM REDEMPTION</div>
      </div>
    </div>
  );
};

// ============================================
// VIDEO PLAYER
// ============================================
const VideoPlayerScreen = ({ goBack }) => (
  <div style={{ height: '100%', background: brand.darkest, overflow: 'auto' }}>
    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <ChevronLeft size={24} color={brand.white} onClick={goBack} style={{ cursor: 'pointer' }} />
      <Share2 size={20} color={brand.gold} />
    </div>
    <div style={{ padding: '20px 20px 0' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 100%)`, borderRadius: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${brand.borderGold}` }}>
        <Play size={64} color={brand.gold} fill={brand.gold} />
      </div>
    </div>
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 10, color: brand.gold, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', fontFamily: fonts.display }}>HITTING MECHANICS · INTERMEDIATE</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6, fontFamily: fonts.display, letterSpacing: -0.5, lineHeight: 1.1 }}>INSIDE PITCH APPROACH</div>
      <div style={{ fontSize: 12, color: brand.muted, marginTop: 10 }}>8:42 · Coach Mike · 124 views</div>
    </div>
  </div>
);

// ============================================
// ME — Profile, Billing, Orders
// ============================================
const MeScreen = ({ navigate }) => {
  const [tab, setTab] = useState('profile');

  return (
    <div style={{ height: '100%', overflow: 'auto', paddingBottom: 100, background: brand.darkest }}>
      <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
        <div style={{ width: 96, height: 96, borderRadius: 48, background: brand.gold, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: brand.dark, fontFamily: fonts.display }}>J</div>
        <div style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5 }}>JAKE RODRIGUEZ</div>
        <div style={{ fontSize: 11, color: brand.muted, marginTop: 4 }}>11U · SS/2B · #7 · Infinite Hitting Dallas N.</div>
      </div>

      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'billing', label: 'Billing' },
          { id: 'orders', label: 'Orders' },
        ].map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '8px 10px', borderRadius: 10, fontSize: 11, fontWeight: 800, textAlign: 'center',
            background: tab === t.id ? brand.gold : brand.darker,
            color: tab === t.id ? brand.dark : brand.muted,
            border: `1px solid ${tab === t.id ? brand.gold : brand.border}`,
            cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 1, textTransform: 'uppercase',
          }}>{t.label}</div>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          <div style={{ padding: '0 20px 20px' }}>
            <SectionLabel>PERSONAL BESTS</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Exit Velo', value: '68', unit: 'mph' },
                { label: 'Launch Angle', value: '15', unit: '°' },
                { label: 'Distance', value: '235', unit: 'ft' },
                { label: 'Contact Rate', value: '71', unit: '%' },
              ].map((m, i) => (
                <div key={i} style={{ background: brand.darker, borderRadius: 14, padding: 16, border: `1px solid ${brand.border}` }}>
                  <div style={{ fontSize: 9, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{m.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
                    <div style={{ fontSize: 30, fontWeight: 700, color: brand.gold, fontFamily: fonts.display, letterSpacing: -0.5 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: brand.muted, fontWeight: 600 }}>{m.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <SectionLabel>ACHIEVEMENTS · 3/12</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[{ icon: Flame, earned: true }, { icon: Check, earned: true }, { icon: Zap, earned: true }, { icon: Award, earned: false }].map((b, i) => (
                <div key={i} style={{ aspectRatio: '1', background: b.earned ? `${brand.gold}15` : brand.darker, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${b.earned ? brand.gold : brand.border}`, opacity: b.earned ? 1 : 0.4 }}>
                  <b.icon size={22} color={b.earned ? brand.gold : brand.muted} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ background: brand.darker, borderRadius: 14, border: `1px solid ${brand.border}` }}>
              {[{ label: 'Settings', icon: User }, { label: 'Notifications', icon: Bell }, { label: 'Privacy', icon: Lock }].map((row, i, arr) => (
                <div key={i} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', cursor: 'pointer' }}>
                  <row.icon size={18} color={brand.muted} />
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{row.label}</div>
                  <ChevronRight size={16} color={brand.muted} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'billing' && (
        <div style={{ padding: '0 20px 20px' }}>
          <SectionLabel>CURRENT PLAN</SectionLabel>
          <div style={{ background: `linear-gradient(135deg, ${brand.darker} 0%, ${brand.dark} 100%)`, borderRadius: 16, padding: 18, border: `1px solid ${brand.borderGold}`, marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 1.5, fontFamily: fonts.display }}>UNLIMITED MONTHLY</div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, marginTop: 4 }}>$280<span style={{ fontSize: 14, color: brand.muted }}>/mo</span></div>
            <div style={{ fontSize: 11, color: brand.muted, marginTop: 6 }}>Unlimited private lessons, group classes, and cage access</div>
          </div>

          <SectionLabel>PAYMENT METHOD</SectionLabel>
          <div style={{ background: brand.darker, borderRadius: 14, padding: 14, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 30, background: brand.dark, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={16} color={brand.gold} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Visa •4242</div>
              <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>Expires 08/28 · Sarah Rodriguez</div>
            </div>
            <Chip color="success" size="sm">AUTO-PAY</Chip>
          </div>

          <SectionLabel>NEXT CHARGE</SectionLabel>
          <div style={{ background: brand.darker, borderRadius: 14, padding: 14, border: `1px solid ${brand.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: brand.muted }}>Date</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>Nov 3, 2025</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: brand.muted }}>Amount</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: brand.gold, fontFamily: fonts.display }}>$280.00</div>
            </div>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div style={{ padding: '0 20px 20px' }}>
          <SectionLabel>ORDER HISTORY</SectionLabel>
          {demoData.orderHistory.map(order => (
            <div key={order.id} style={{ background: brand.darker, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${brand.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${brand.gold}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} color={brand.gold} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{order.itemName}</div>
                <div style={{ fontSize: 10, color: brand.muted, marginTop: 2 }}>{order.date} · {order.status}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: order.method === 'points' ? brand.gold : brand.cream, fontFamily: fonts.display }}>
                  {order.method === 'points' ? `${order.amount} pts` : `$${order.amount}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// BOTTOM NAV — 5 tabs
// ============================================
const BottomNav = ({ current, navigate }) => (
  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(28, 27, 26, 0.95)', backdropFilter: 'blur(20px)', borderTop: `1px solid ${brand.border}`, padding: '10px 8px 24px', display: 'flex', justifyContent: 'space-around' }}>
    {[
      { id: 'home', icon: Home, label: 'Home' },
      { id: 'work', icon: Briefcase, label: 'Work' },
      { id: 'book', icon: Calendar, label: 'Book' },
      { id: 'earn', icon: Sparkles, label: 'Earn' },
      { id: 'me', icon: User, label: 'Me' },
    ].map(t => {
      const active = current === t.id;
      return (
        <div key={t.id} onClick={() => navigate(t.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '4px 10px' }}>
          <t.icon size={20} color={active ? brand.gold : brand.muted} strokeWidth={active ? 2.5 : 2} />
          <div style={{ fontSize: 10, fontWeight: active ? 800 : 500, color: active ? brand.gold : brand.muted, letterSpacing: 0.5, fontFamily: fonts.display, textTransform: 'uppercase' }}>{t.label}</div>
        </div>
      );
    })}
  </div>
);

// ============================================
// APP SHELL
// ============================================
export default function App() {
  const [screen, setScreen] = useState('home');
  const [params, setParams] = useState({});
  const [history, setHistory] = useState([]);

  const navigate = (newScreen, newParams = {}) => {
    setHistory([...history, { screen, params }]);
    setScreen(newScreen);
    setParams(newParams);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory(history.slice(0, -1));
      setScreen(prev.screen);
      setParams(prev.params);
    }
  };

  const renderScreen = () => {
    switch (screen) {
      case 'home': return <HomeScreen navigate={navigate} />;
      case 'work': return <WorkScreen navigate={navigate} />;
      case 'book': return <BookScreen navigate={navigate} />;
      case 'book-confirm': return <BookConfirmScreen navigate={navigate} goBack={goBack} params={params} />;
      case 'earn': return <EarnScreen navigate={navigate} />;
      case 'me': return <MeScreen navigate={navigate} />;
      case 'session-detail': return <SessionDetailScreen navigate={navigate} goBack={goBack} params={params} />;
      case 'swing-detail': return <SwingDetailScreen navigate={navigate} goBack={goBack} params={params} />;
      case 'homework-video-detail': return <HomeworkVideoDetailScreen goBack={goBack} params={params} />;
      case 'share-card': return <ShareCardScreen goBack={goBack} params={params} />;
      case 'assignment-detail': return <AssignmentDetailScreen navigate={navigate} goBack={goBack} params={params} />;
      case 'assignment-record': return <RecordAssignmentScreen navigate={navigate} goBack={goBack} />;
      case 'reward-redeem': return <RewardRedeemScreen navigate={navigate} goBack={goBack} params={params} />;
      case 'store-item': return <StoreItemScreen goBack={goBack} navigate={navigate} params={params} />;
      case 'video-player': return <VideoPlayerScreen goBack={goBack} />;
      case 'message-thread': return <MessageThreadScreen goBack={goBack} />;
      default: return <HomeScreen navigate={navigate} />;
    }
  };

  const hideNav = ['session-detail', 'swing-detail', 'homework-video-detail', 'share-card', 'assignment-detail', 'assignment-record', 'reward-redeem', 'store-item', 'video-player', 'message-thread', 'book-confirm'].includes(screen);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, fontFamily: fonts.body }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 10, color: brand.gold, fontWeight: 700, letterSpacing: 3, fontFamily: fonts.display }}>INFINITE HITTING</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: brand.white, marginTop: 4, fontFamily: fonts.display, letterSpacing: -0.5 }}>ATHLETE APP · v0.4</div>
      </div>
      <PhoneFrame>
        {renderScreen()}
        {!hideNav && <BottomNav current={screen} navigate={navigate} />}
      </PhoneFrame>
      <div style={{ color: '#666', fontSize: 11, fontWeight: 500, maxWidth: 520, textAlign: 'center', lineHeight: 1.6 }}>
        <b>v0.4 changes:</b> 5 bottom tabs instead of 7 · Work tab absorbs Videos + Training · Unified Messages (text + video + thread history) · Book tab for lessons/classes/cages · Earn tab combines Rewards/Store/Leaderboard · Store has dual pricing ($ or points) · Me tab adds Billing + Orders
      </div>
    </div>
  );
}
