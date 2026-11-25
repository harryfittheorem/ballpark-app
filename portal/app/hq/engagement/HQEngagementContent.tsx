'use client';

import { useState, type ElementType } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { Activity, AlertCircle, Users, TrendingUp, Clock } from 'lucide-react';

type RoleFilter = 'All' | 'Owner' | 'GM' | 'Instructor';
type StatusFilter = 'All' | 'Active' | 'Warning' | 'Inactive';

interface UserRow {
  id: number;
  name: string;
  role: 'Owner' | 'GM' | 'Instructor';
  location: string;
  lastActive: string;
  daysInactive: number;
  logins30d: number;
  avgSession: string;
  checklistPct: number;
  trainual: number;
  score: number;
}

const USERS: UserRow[] = [
  { id: 1,  name: 'James Calloway',  role: 'Owner',      location: 'Chicago — Lincoln Park',  lastActive: 'Today',      daysInactive: 0,  logins30d: 24, avgSession: '12 min', checklistPct: 98, trainual: 100, score: 97 },
  { id: 2,  name: 'Mike Torres',     role: 'GM',         location: 'Chicago — Lincoln Park',  lastActive: 'Yesterday',  daysInactive: 1,  logins30d: 21, avgSession: '9 min',  checklistPct: 96, trainual: 100, score: 94 },
  { id: 3,  name: 'Sandra Mejia',    role: 'Owner',      location: 'Dallas — Frisco',         lastActive: 'Today',      daysInactive: 0,  logins30d: 20, avgSession: '11 min', checklistPct: 95, trainual: 95,  score: 93 },
  { id: 4,  name: 'Carlos Vega',     role: 'GM',         location: 'Dallas — Frisco',         lastActive: '2 days ago', daysInactive: 2,  logins30d: 18, avgSession: '8 min',  checklistPct: 92, trainual: 90,  score: 88 },
  { id: 5,  name: 'Derek Thompson',  role: 'Owner',      location: 'Atlanta — Alpharetta',    lastActive: '5 days ago', daysInactive: 5,  logins30d: 12, avgSession: '7 min',  checklistPct: 83, trainual: 70,  score: 71 },
  { id: 6,  name: 'Ashley Rivera',   role: 'GM',         location: 'Atlanta — Alpharetta',    lastActive: '8 days ago', daysInactive: 8,  logins30d: 9,  avgSession: '6 min',  checklistPct: 76, trainual: 60,  score: 62 },
  { id: 7,  name: 'Brian Park',      role: 'Instructor', location: 'Chicago — Lincoln Park',  lastActive: 'Today',      daysInactive: 0,  logins30d: 26, avgSession: '5 min',  checklistPct: 99, trainual: 100, score: 96 },
  { id: 8,  name: 'Tanya Moore',     role: 'Instructor', location: 'Dallas — Frisco',         lastActive: '3 days ago', daysInactive: 3,  logins30d: 15, avgSession: '5 min',  checklistPct: 88, trainual: 80,  score: 80 },
  { id: 9,  name: 'Jason Okafor',    role: 'GM',         location: 'Houston — Sugar Land',    lastActive: '14 days ago',daysInactive: 14, logins30d: 5,  avgSession: '4 min',  checklistPct: 61, trainual: 40,  score: 44 },
  { id: 10, name: 'Lisa Chen',       role: 'Owner',      location: 'Houston — Sugar Land',    lastActive: '21 days ago',daysInactive: 21, logins30d: 2,  avgSession: '3 min',  checklistPct: 55, trainual: 30,  score: 29 },
  { id: 11, name: 'Ray Nguyen',      role: 'Instructor', location: 'Houston — Sugar Land',    lastActive: '30 days ago',daysInactive: 30, logins30d: 1,  avgSession: '2 min',  checklistPct: 42, trainual: 20,  score: 18 },
  { id: 12, name: 'Priya Mehta',     role: 'Owner',      location: 'Phoenix — Scottsdale',    lastActive: 'Yesterday',  daysInactive: 1,  logins30d: 19, avgSession: '10 min', checklistPct: 91, trainual: 95,  score: 91 },
];

function scoreColor(score: number) {
  if (score >= 80) return brand.success;
  if (score >= 50) return brand.warning;
  return brand.danger;
}

function statusLabel(daysInactive: number): { label: string; bg: string; color: string } {
  if (daysInactive <= 7)  return { label: 'Active',   bg: '#dcfce7', color: '#166534' };
  if (daysInactive <= 14) return { label: 'Warning',  bg: '#fef9c3', color: '#854d0e' };
  if (daysInactive <= 21) return { label: 'At Risk',  bg: '#ffedd5', color: '#9a3412' };
  return                         { label: 'Inactive', bg: '#fee2e2', color: '#991b1b' };
}

export function HQEngagementContent() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  const filtered = USERS.filter(u => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (statusFilter === 'Active'   && u.daysInactive > 7)  return false;
    if (statusFilter === 'Warning'  && (u.daysInactive <= 7 || u.daysInactive > 14)) return false;
    if (statusFilter === 'Inactive' && u.daysInactive <= 14) return false;
    return true;
  });

  const inactiveCount = (days: number) => USERS.filter(u => u.daysInactive >= days).length;
  const avgScore = Math.round(USERS.reduce((s, u) => s + u.score, 0) / USERS.length);

  return (
    <div style={{ padding: 28, maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: '0 0 4px' }}>
          App Engagement
        </h1>
        <p style={{ color: brand.textMuted, fontSize: 13, margin: 0 }}>
          Per-user activity analytics across all roles and locations
        </p>
      </div>

      {/* KPI summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        {([
          { label: 'Total Users', value: String(USERS.length), icon: Users as ElementType, color: brand.text },
          { label: 'Active (≤7d)', value: String(USERS.filter(u => u.daysInactive <= 7).length), icon: Activity as ElementType, color: brand.success },
          { label: 'Avg Eng. Score', value: `${avgScore}/100`, icon: TrendingUp as ElementType, color: brand.gold },
          { label: 'Inactive >14d', value: String(inactiveCount(14)), icon: AlertCircle as ElementType, color: brand.warning },
          { label: 'Inactive >30d', value: String(inactiveCount(30)), icon: Clock as ElementType, color: brand.danger },
        ] as { label: string; value: string; icon: ElementType; color: string }[]).map(k => (
          <div key={k.label} style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${k.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <k.icon size={16} color={k.color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.text }}>{k.value}</div>
              <div style={{ fontSize: 11, color: brand.textMuted }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert strip for inactive */}
      {inactiveCount(14) > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <AlertCircle size={15} color="#c2410c" />
          <span style={{ color: '#7c2d12' }}>
            <strong>{inactiveCount(14)} user{inactiveCount(14) > 1 ? 's' : ''}</strong> inactive for 14+ days — consider a check-in call or follow-up.
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Role</span>
          {(['All', 'Owner', 'GM', 'Instructor'] as RoleFilter[]).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: roleFilter === r ? brand.goldDeep : brand.surface,
              color: roleFilter === r ? brand.darker : brand.textMuted,
              border: `1px solid ${roleFilter === r ? brand.goldDeep : brand.border}`,
            }}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' }}>Status</span>
          {(['All', 'Active', 'Warning', 'Inactive'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: statusFilter === s ? brand.goldDeep : brand.surface,
              color: statusFilter === s ? brand.darker : brand.textMuted,
              border: `1px solid ${statusFilter === s ? brand.goldDeep : brand.border}`,
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
              {['Name', 'Role', 'Location', 'Last Active', 'Logins (30d)', 'Avg Session', 'Checklist', 'Trainual', 'Score', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.7, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => {
              const st = statusLabel(u.daysInactive);
              return (
                <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <td style={{ padding: '11px 14px', fontWeight: 600, color: brand.text }}>{u.name}</td>
                  <td style={{ padding: '11px 14px', color: brand.textMuted, fontSize: 12 }}>{u.role}</td>
                  <td style={{ padding: '11px 14px', color: brand.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>{u.location}</td>
                  <td style={{ padding: '11px 14px', color: brand.textMuted, fontSize: 12 }}>{u.lastActive}</td>
                  <td style={{ padding: '11px 14px', color: brand.text }}>{u.logins30d}</td>
                  <td style={{ padding: '11px 14px', color: brand.textMuted }}>{u.avgSession}</td>
                  <td style={{ padding: '11px 14px', color: brand.text }}>{u.checklistPct}%</td>
                  <td style={{ padding: '11px 14px', color: brand.text }}>{u.trainual}%</td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontWeight: 700, color: scoreColor(u.score) }}>{u.score}</span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>No users match the selected filters.</div>
        )}
      </div>

      {/* Score explanation */}
      <div style={{ marginTop: 16, padding: '10px 16px', background: `${brand.gold}08`, border: `1px solid ${brand.border}`, borderRadius: 8, fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>
        <strong style={{ color: brand.gold }}>Engagement Score</strong> — Composite 0–100 based on: login frequency (30%), checklist completion (25%), Trainual progress (25%), avg session length (20%). Flags: 7d = warning, 14d = alert, 30d = inactive.
      </div>
    </div>
  );
}
