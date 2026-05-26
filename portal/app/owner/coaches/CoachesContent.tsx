'use client';

import { useState, useEffect, useTransition } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, BarChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { UserCog, Activity, TrendingUp, DollarSign, Download, Plus, Star, MessageCircle, X, Shield, GraduationCap } from 'lucide-react';
import type { OwnerCoach } from '@/lib/supabase/ownerQueries';
import { CoachMessagePanel } from './CoachMessagePanel';
import { exportCsv } from '@/lib/exportCsv';
import { updateCoachPreset } from './actions';

type Props = { coaches: OwnerCoach[]; tenantId: string };

const DEMO_COACHES: OwnerCoach[] = [
  { id: 'c1', userId: null, name: 'Mike Rodriguez',  specialty: 'Hitting / Power',       students: 48, utilization: 92, retention: 94, avgRating: 4.9, revenue: 13440, weeklyHours: 38, joinedDate: 'Jan 2023', preset: 'staff' },
  { id: 'c2', userId: null, name: 'Sarah Kim',       specialty: 'Pitching / Mechanics',  students: 41, utilization: 85, retention: 91, avgRating: 4.8, revenue: 11480, weeklyHours: 34, joinedDate: 'Mar 2023', preset: 'instructor' },
  { id: 'c3', userId: null, name: 'Dave Thompson',   specialty: 'Fielding / Speed',      students: 36, utilization: 78, retention: 88, avgRating: 4.7, revenue: 10080, weeklyHours: 30, joinedDate: 'Aug 2023', preset: 'instructor' },
  { id: 'c4', userId: null, name: 'Jess Morales',    specialty: 'Catching / Defence',    students: 22, utilization: 68, retention: 86, avgRating: 4.6, revenue: 6160,  weeklyHours: 22, joinedDate: 'Feb 2024', preset: 'instructor' },
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${brand.border}`,
  borderRadius: 7, fontSize: 13, color: brand.text, background: brand.surface,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

const PRESET_META = {
  instructor: {
    label: 'Instructor',
    color: brand.goldDeep,
    bg: 'rgba(184,162,104,0.12)',
    border: 'rgba(184,162,104,0.35)',
    Icon: GraduationCap,
    description: 'Training tools only (Inbox, Sessions, Assignments)',
  },
  staff: {
    label: 'Staff',
    color: brand.success ?? '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.3)',
    Icon: Shield,
    description: 'Training + Operations (Schedule, Check-In, Families, Redemptions)',
  },
} as const;

function PresetBadge({ preset }: { preset: 'instructor' | 'staff' }) {
  const { label, color, bg, border, Icon } = PRESET_META[preset];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 20,
      background: bg, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, fontFamily: fonts.display,
      letterSpacing: 0.4, color,
    }}>
      <Icon size={10} />
      {label}
    </span>
  );
}

function PresetDropdown({
  coachId,
  current,
  disabled,
  onOptimistic,
}: {
  coachId: string;
  current: 'instructor' | 'staff';
  disabled: boolean;
  onOptimistic: (id: string, next: 'instructor' | 'staff') => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as 'instructor' | 'staff';
    onOptimistic(coachId, next);
    const fd = new FormData();
    fd.append('coachId', coachId);
    fd.append('preset', next);
    startTransition(() => { updateCoachPreset(fd).catch(console.error); });
  };

  if (disabled) {
    return <span style={{ fontSize: 11, color: brand.textMuted }}>Demo mode</span>;
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      disabled={pending}
      style={{
        padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
        fontFamily: fonts.display, border: `1px solid ${brand.border}`,
        background: brand.surface, color: brand.text, cursor: 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      <option value="instructor">Instructor</option>
      <option value="staff">Staff</option>
    </select>
  );
}

export function CoachesContent({ coaches: rawCoaches, tenantId }: Props) {
  const isDemo        = !rawCoaches.length;
  const [coaches, setCoaches] = useState<OwnerCoach[]>(isDemo ? DEMO_COACHES : rawCoaches);

  const totalStudents = coaches.reduce((s, c) => s + c.students, 0);
  const avgUtil       = coaches.length > 0 ? Math.round(coaches.reduce((s, c) => s + c.utilization, 0) / coaches.length) : 0;
  const avgRet        = coaches.length > 0 ? Math.round(coaches.reduce((s, c) => s + c.retention, 0) / coaches.length * 10) / 10 : 0;

  const [activeCoach,  setActiveCoach]  = useState<OwnerCoach | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [hireForm, setHireForm] = useState({ name: '', email: '', specialty: '', weeklyHours: '30' });

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  const handleExport = () => {
    exportCsv(`coaches-${new Date().toISOString().slice(0, 10)}.csv`,
      coaches as unknown as Record<string, unknown>[],
      [
        { label: 'Name',        key: 'name' },
        { label: 'Specialty',   key: 'specialty' },
        { label: 'Preset',      key: 'preset' },
        { label: 'Students',    key: 'students' },
        { label: 'Utilization', key: 'utilization' },
        { label: 'Retention',   key: 'retention' },
        { label: 'Rating',      key: 'avgRating' },
        { label: 'Revenue',     key: 'revenue' },
        { label: 'Hours/wk',    key: 'weeklyHours' },
        { label: 'Joined',      key: 'joinedDate' },
      ],
    );
    setToast(`Exported ${coaches.length} coaches as CSV`);
  };

  const handleHireSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowHireModal(false);
    setHireForm({ name: '', email: '', specialty: '', weeklyHours: '30' });
    setToast(`Invitation sent to ${hireForm.email} — ${hireForm.name} will appear once they complete onboarding`);
  };

  const handleOptimisticPreset = (id: string, next: 'instructor' | 'staff') => {
    setCoaches(prev => prev.map(c => c.id === id ? { ...c, preset: next } : c));
    setToast(`Updated — access tier change takes effect on next login.`);
  };

  const columns: TableColumn<OwnerCoach & Record<string, unknown>>[] = [
    {
      label: 'Coach', key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, fontFamily: fonts.display }}>
            {(r.name as string).split(' ').pop()?.charAt(0) ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>{r.name as string}</div>
            <div style={{ fontSize: 11, color: brand.textMuted }}>{r.specialty as string}</div>
          </div>
        </div>
      ),
    },
    {
      label: 'Access Tier', key: 'preset',
      render: (r) => {
        const coach = r as unknown as OwnerCoach;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PresetBadge preset={coach.preset} />
            <PresetDropdown
              coachId={coach.id}
              current={coach.preset}
              disabled={isDemo || !coach.userId}
              onOptimistic={handleOptimisticPreset}
            />
          </div>
        );
      },
    },
    {
      label: 'Students', key: 'students', align: 'right',
      render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700 }}>{r.students as number}</span>,
    },
    {
      label: 'Utilization', key: 'utilization',
      render: (r) => {
        const v = r.utilization as number;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 80, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${v}%`, height: '100%', background: v >= 80 ? brand.success : v >= 70 ? brand.warning : brand.danger }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: fonts.mono }}>{v}%</span>
          </div>
        );
      },
    },
    {
      label: 'Retention', key: 'retention', align: 'right',
      render: (r) => <span style={{ color: (r.retention as number) >= 90 ? brand.success : brand.warning, fontWeight: 700 }}>{r.retention as number}%</span>,
    },
    {
      label: 'Rating', key: 'avgRating', align: 'right',
      render: (r) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <Star size={12} color={brand.goldDeep} fill={brand.goldDeep} />
          <span style={{ fontWeight: 700, fontFamily: fonts.display }}>{r.avgRating as number}</span>
        </div>
      ),
    },
    {
      label: 'Hours/wk', key: 'weeklyHours', align: 'right',
      render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.weeklyHours as number}</span>,
    },
    {
      label: 'Joined', key: 'joinedDate',
      render: (r) => <span style={{ fontSize: 11, color: brand.textMuted }}>{r.joinedDate as string}</span>,
    },
    {
      label: '', key: 'actions',
      render: (r) => {
        const coach = r as unknown as OwnerCoach;
        const disabled = isDemo || !coach.userId;
        return (
          <button
            onClick={() => { if (!disabled) setActiveCoach(coach); }}
            disabled={disabled}
            title={isDemo ? 'Demo mode — connect real data to send messages' : !coach.userId ? 'Coach has no login account' : `Send message as ${coach.name}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: disabled ? brand.surfaceAlt : brand.dark,
              color: disabled ? brand.textLight : brand.gold,
              border: `1px solid ${disabled ? brand.border : brand.dark}`,
              opacity: disabled ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <MessageCircle size={12} />
            Message
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Coach Management"
        subtitle={`${coaches.length} coach${coaches.length !== 1 ? 'es' : ''} on staff · ${totalStudents} total students`}
        actions={
          <>
            <OButton variant="secondary" icon={Download} onClick={handleExport}>Export</OButton>
            <OButton variant="gold" icon={Plus} onClick={() => setShowHireModal(true)}>Hire Coach</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard label="Staff Size"      value={coaches.length}    icon={UserCog} />
          <KPICard label="Avg Utilization" value={`${avgUtil}%`}     icon={Activity}   color="success" />
          <KPICard label="Avg Retention"   value={`${avgRet}%`}      icon={TrendingUp}  color="success" />
          <KPICard label="Total Students"  value={totalStudents}     icon={DollarSign}  color="gold" />
        </div>

        <div style={{ marginBottom: 8, padding: '10px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>
          <strong style={{ color: brand.text }}>Access Tiers:</strong>{' '}
          <span style={{ color: PRESET_META.instructor.color }}>Instructor</span> — training tools only (Inbox, Sessions, Assignments). {' '}
          <span style={{ color: PRESET_META.staff.color }}>Staff</span> — adds operational sections (Schedule, Check-In, Families, Redemptions). Changes take effect on the coach&apos;s next login.
        </div>

        <SectionHeader title="Coach Roster — Performance" />
        <OTable
          columns={columns as TableColumn<Record<string, unknown>>[]}
          rows={coaches as unknown as Record<string, unknown>[]}
        />

        {coaches.length > 1 && (
          <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <OCard>
              <SectionHeader title="Utilization Distribution" />
              <BarChart
                data={coaches.map(c => ({
                  label:     c.name.split(' ').pop()?.substring(0, 8) ?? c.name.substring(0, 8),
                  value:     c.utilization,
                  highlight: c.utilization >= 85,
                }))}
                height={180}
              />
            </OCard>

            <OCard>
              <SectionHeader title="Retention by Coach" subtitle="Student retention per coach" />
              {[...coaches].sort((a, b) => b.retention - a.retention).map((c, i, arr) => (
                <div key={c.id} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ flex: 1, height: 8, background: brand.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${c.retention}%`, height: '100%', background: c.retention >= 90 ? brand.success : brand.warning }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: fonts.display, color: c.retention >= 90 ? brand.success : brand.warning, width: 50, textAlign: 'right' }}>{c.retention}%</div>
                </div>
              ))}
            </OCard>
          </div>
        )}
      </div>

      {activeCoach && (
        <CoachMessagePanel
          coach={activeCoach}
          tenantId={tenantId}
          onClose={() => setActiveCoach(null)}
        />
      )}

      {showHireModal && (
        <div
          onClick={() => setShowHireModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 460, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>Hire New Coach</div>
              <div onClick={() => setShowHireModal(false)} style={{ cursor: 'pointer', padding: 4 }}><X size={16} color={brand.textMuted} /></div>
            </div>
            <form onSubmit={handleHireSubmit} style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input required style={inputStyle} value={hireForm.name} onChange={e => setHireForm(f => ({ ...f, name: e.target.value }))} placeholder="Alex Johnson" />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input required type="email" style={inputStyle} value={hireForm.email} onChange={e => setHireForm(f => ({ ...f, email: e.target.value }))} placeholder="alex@infinitehitting.com" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Specialty</label>
                  <select style={{ ...inputStyle, appearance: 'auto' }} value={hireForm.specialty} onChange={e => setHireForm(f => ({ ...f, specialty: e.target.value }))}>
                    <option>Hitting / Power</option>
                    <option>Pitching / Mechanics</option>
                    <option>Fielding / Speed</option>
                    <option>Catching / Defence</option>
                    <option>General / Multi-skill</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Weekly Hours</label>
                  <input type="number" min="1" max="60" style={inputStyle} value={hireForm.weeklyHours} onChange={e => setHireForm(f => ({ ...f, weeklyHours: e.target.value }))} />
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: brand.surfaceAlt, borderRadius: 8, marginBottom: 20, fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>
                An invitation email will be sent to the coach. They&apos;ll set their password and appear in the roster once they complete onboarding.
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <OButton variant="secondary" onClick={() => setShowHireModal(false)}>Cancel</OButton>
                <OButton variant="gold" icon={Plus}>Send Invitation</OButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 500, background: brand.dark, color: brand.gold, padding: '12px 20px', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.24)', fontSize: 13, fontWeight: 600, maxWidth: 380 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
