'use client';

import { useState, useEffect, useTransition } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { KPICard, OButton, PageHeader, SectionHeader, OCard, OTable, BarChart } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { UserCog, Activity, Download, Plus, Star, X, Shield, GraduationCap, TrendingUp } from 'lucide-react';
import type { OwnerCoach } from '@/lib/supabase/ownerQueries';
import { exportCsv } from '@/lib/exportCsv';
import { updateCoachPreset } from './actions';

type Props = { coaches: OwnerCoach[]; tenantId: string };

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

  if (disabled) return <span style={{ fontSize: 11, color: brand.textMuted }}>No coach account linked</span>;

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

type RetentionAgeRow = { ageGroup: string; retained: number; total: number; pct: number };

function retentionColor(pct: number): string {
  if (pct >= 80) return brand.success ?? '#4ade80';
  if (pct >= 60) return brand.warning;
  return brand.danger;
}

export function CoachesContent({ coaches: rawCoaches }: Props) {
  const [coaches, setCoaches] = useState<OwnerCoach[]>(rawCoaches);

  const totalStudents = coaches.reduce((s, c) => s + c.students, 0);
  const avgUtil       = coaches.length > 0 ? Math.round(coaches.reduce((s, c) => s + c.utilization, 0) / coaches.length) : 0;

  // Aggregate retention by age across all coaches (merge each coach's retentionByAge).
  const ageMap: Record<string, { retained: number; total: number }> = {};
  for (const c of coaches) {
    for (const row of (c.retentionByAge ?? [])) {
      if (!ageMap[row.ageGroup]) ageMap[row.ageGroup] = { retained: 0, total: 0 };
      ageMap[row.ageGroup].retained += row.retained;
      ageMap[row.ageGroup].total    += row.total;
    }
  }
  const AGE_ORDER = ['8U', '10U', '12U', '14U', 'HS', 'College'];
  const retentionByAge: RetentionAgeRow[] = AGE_ORDER
    .filter(ag => ageMap[ag]?.total > 0)
    .map(ag => ({
      ageGroup: ag,
      retained: ageMap[ag].retained,
      total:    ageMap[ag].total,
      pct:      Math.round((ageMap[ag].retained / ageMap[ag].total) * 100),
    }));

  const [showHireModal, setShowHireModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
        { label: 'Rating',      key: 'avgRating' },
        { label: 'Rated Lessons', key: 'ratedCount' },
        { label: 'Eligible Lessons', key: 'eligibleCount' },
        { label: 'Revenue',     key: 'revenue' },
        { label: 'Hours/wk',    key: 'weeklyHours' },
        { label: 'Joined',      key: 'joinedDate' },
      ],
    );
    setToast(`Exported ${coaches.length} coaches as CSV`);
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
              disabled={!coach.userId}
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
      label: 'Rating (1–5★)',
      key: 'avgRating', align: 'right',
      render: (r) => {
        const rating = r.avgRating as number | null;
        const coach = r as unknown as OwnerCoach & { ratedCount?: number; eligibleCount?: number };
        const tooltip = `Average post-lesson rating (1–5 ★) submitted by parents after each completed session. ${coach.ratedCount ?? 0} of ${coach.eligibleCount ?? 0} eligible lessons rated.`;
        if (rating === null) return (
          <span style={{ color: brand.textMuted, fontFamily: fonts.mono }} title={tooltip}>
            — · {coach.ratedCount ?? 0}/{coach.eligibleCount ?? 0}
          </span>
        );
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} title={tooltip}>
            <Star size={12} color={brand.goldDeep} fill={brand.goldDeep} />
            <span style={{ fontWeight: 700, fontFamily: fonts.display }}>{rating.toFixed(1)}</span>
            <span style={{ color: brand.textMuted, fontSize: 10 }}>{coach.ratedCount ?? 0}/{coach.eligibleCount ?? 0} rated</span>
          </div>
        );
      },
    },
    {
      label: 'Retention (90d)', key: 'retention', align: 'right',
      render: (r) => {
        const pct = r.retention as number;
        const students = r.students as number;
        if (students === 0) return <span style={{ fontSize: 11, color: brand.textMuted }}>—</span>;
        const color = retentionColor(pct);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} title={`${pct}% of this coach's students from the past 90 days still have an active or paused membership.`}>
            <div style={{ width: 60, height: 6, background: brand.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color }} />
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
          </div>
        );
      },
    },
    {
      label: 'Revenue (90d)', key: 'revenue', align: 'right',
      render: (r) => {
        const rev = r.revenue as number;
        return (
          <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: rev > 0 ? brand.text : brand.textMuted }}>
            {rev > 0 ? `$${rev.toLocaleString()}` : '–'}
          </span>
        );
      },
    },
    {
      label: 'Hours/wk', key: 'weeklyHours', align: 'right',
      render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.weeklyHours as number}</span>,
    },
    {
      label: 'Joined', key: 'joinedDate',
      render: (r) => <span style={{ fontSize: 11, color: brand.textMuted }}>{r.joinedDate as string}</span>,
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
            <OButton variant="gold" icon={Plus} onClick={() => setShowHireModal(true)}>Add Coach</OButton>
          </>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KPICard label="Staff Size"      value={coaches.length}    icon={UserCog} />
          <KPICard label="Avg Utilization" value={coaches.length ? `${avgUtil}%` : '—'} icon={Activity} color="success" />
          <KPICard label="Total Students"  value={totalStudents}     icon={UserCog}  color="gold" />
          {coaches.length > 0 && (() => {
            const withStudents = coaches.filter(c => c.students > 0);
            const avgRet = withStudents.length > 0 ? Math.round(withStudents.reduce((s, c) => s + c.retention, 0) / withStudents.length) : 0;
            return <KPICard label="Avg Retention (90d)" value={withStudents.length ? `${avgRet}%` : '—'} icon={TrendingUp} color={avgRet >= 80 ? 'success' : avgRet >= 60 ? 'warning' : 'danger'} />;
          })()}
        </div>

        <div style={{ marginBottom: 8, padding: '10px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>
          <strong style={{ color: brand.text }}>Access Tiers:</strong>{' '}
          <span style={{ color: PRESET_META.instructor.color }}>Instructor</span> — training tools only (Inbox, Sessions, Assignments). {' '}
          <span style={{ color: PRESET_META.staff.color }}>Staff</span> — adds operational sections (Schedule, Check-In, Families, Redemptions). Changes take effect on the coach&apos;s next login.
        </div>

        <SectionHeader title="Coach Roster — Performance" />
        {coaches.length ? <OTable
          columns={columns as TableColumn<Record<string, unknown>>[]}
          rows={coaches as unknown as Record<string, unknown>[]}
        /> : <OCard><div style={{ textAlign: 'center', padding: '34px 16px' }}><div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>No coaches recorded</div><div style={{ fontSize: 12, color: brand.textMuted }}>This roster shows real coach data only. Add-coach invitations are not connected in this portal.</div></div></OCard>}
        <div style={{ marginTop: 16, padding: '10px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, fontSize: 11, color: brand.textMuted }}>
          <strong style={{ color: brand.text }}>Retention (90d)</strong> — share of each coach&apos;s students from the past 90 days who still hold an active or paused membership today.
        </div>

        {coaches.length > 1 && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
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

            {retentionByAge.length > 0 && (
              <OCard>
                <SectionHeader title="Retention by Age Group (90d)" subtitle="Share of students who trained in the last 90 days still holding an active/paused membership — across all coaches" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                  {retentionByAge.map(row => (
                    <div key={row.ageGroup} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, fontSize: 11, fontWeight: 700, fontFamily: fonts.display, color: brand.text, textAlign: 'right', flexShrink: 0 }}>
                        {row.ageGroup}
                      </div>
                      <div style={{ flex: 1, height: 10, background: brand.border, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${row.pct}%`, height: '100%', background: retentionColor(row.pct), borderRadius: 5, transition: 'width 0.4s ease' }} />
                      </div>
                      <div style={{ width: 80, fontSize: 11, fontFamily: fonts.mono, fontWeight: 700, color: retentionColor(row.pct), flexShrink: 0 }}>
                        {row.pct}% <span style={{ color: brand.textMuted, fontWeight: 400 }}>({row.retained}/{row.total})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </OCard>
            )}
          </div>
        )}
      </div>

      {showHireModal && (
        <div role="dialog" aria-modal="true" aria-labelledby="add-coach-title" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(460px, 100%)', background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
              <div id="add-coach-title" style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>Add Coach</div>
              <button aria-label="Close" onClick={() => setShowHireModal(false)} style={{ cursor: 'pointer', padding: 6, border: 0, background: 'transparent' }}><X size={16} color={brand.textMuted} /></button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Coach creation is unavailable here</div>
              <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.6 }}>No connected staff-creation flow is available in this portal. When coaches are added through the admin panel, only <strong style={{ color: brand.text }}>Hitting Instructor</strong> is permitted as the coach type for new locations. Specialty Coach is not an allowed type.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}><OButton variant="secondary" onClick={() => setShowHireModal(false)}>Close</OButton></div>
            </div>
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
