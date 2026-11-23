'use client';

import { useState, useEffect, useCallback } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OCard, PageHeader, OButton, SectionHeader } from '@/components/owner/ui';
import { createClient } from '@/lib/supabase/client';

// Nav sections that can be toggled per preset.
const CONFIGURABLE_SECTIONS = [
  { key: 'schedule',    label: 'Schedule',       defaultStaff: true,  defaultInstructor: false },
  { key: 'checkin',     label: 'Check-In',       defaultStaff: true,  defaultInstructor: false },
  { key: 'families',    label: 'Families',        defaultStaff: true,  defaultInstructor: false },
  { key: 'redemptions', label: 'Redemptions',     defaultStaff: true,  defaultInstructor: false },
  { key: 'playbook',    label: 'Training Playbook', defaultStaff: true, defaultInstructor: true },
] as const;

type SectionKey = typeof CONFIGURABLE_SECTIONS[number]['key'];
type AccessConfig = { instructor: SectionKey[]; staff: SectionKey[] };

function defaultConfig(): AccessConfig {
  return {
    instructor: CONFIGURABLE_SECTIONS.filter(s => s.defaultInstructor).map(s => s.key),
    staff: CONFIGURABLE_SECTIONS.filter(s => s.defaultStaff).map(s => s.key),
  };
}

function StaffAccessPanel() {
  const [config, setConfig] = useState<AccessConfig>(defaultConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
          .from('tenants').select('staff_access_config').maybeSingle();
        if (data?.staff_access_config && typeof data.staff_access_config === 'object') {
          const raw = data.staff_access_config as Partial<AccessConfig>;
          setConfig({
            instructor: Array.isArray(raw.instructor) ? raw.instructor as SectionKey[] : defaultConfig().instructor,
            staff: Array.isArray(raw.staff) ? raw.staff as SectionKey[] : defaultConfig().staff,
          });
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const toggle = (preset: 'instructor' | 'staff', key: SectionKey) => {
    setConfig(prev => {
      const list = prev[preset];
      return { ...prev, [preset]: list.includes(key) ? list.filter(k => k !== key) : [...list, key] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/owner/settings/staff-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <OCard style={{ marginTop: 24 }}>
      <div style={{ padding: '4px 4px 8px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
          Staff Access Profiles
        </div>
        <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 20 }}>
          Control which nav sections each staff preset can access. Changes take effect on the staff member&apos;s next login.
          <br />
          <strong style={{ color: brand.warning }}>Note:</strong> Billing, Revenue Reports, and owner-only analytics are always restricted to Owner accounts — these cannot be enabled for staff.
        </div>

        {loading ? (
          <div style={{ fontSize: 12, color: brand.textMuted }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${brand.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: brand.textMuted, fontWeight: 700, letterSpacing: 0.6, fontSize: 10, textTransform: 'uppercase' }}>Section</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: brand.goldDeep, fontWeight: 700, letterSpacing: 0.6, fontSize: 10, textTransform: 'uppercase' }}>Instructor</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: brand.success ?? '#4ade80', fontWeight: 700, letterSpacing: 0.6, fontSize: 10, textTransform: 'uppercase' }}>Staff</th>
                </tr>
              </thead>
              <tbody>
                {CONFIGURABLE_SECTIONS.map((section, i) => (
                  <tr key={section.key} style={{ borderBottom: i < CONFIGURABLE_SECTIONS.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <td style={{ padding: '10px 12px', color: brand.text, fontWeight: 600 }}>{section.label}</td>
                    {(['instructor', 'staff'] as const).map(preset => (
                      <td key={preset} style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={config[preset].includes(section.key)}
                            onChange={() => toggle(preset, section.key)}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: brand.goldDeep }}
                          />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 16 }}>
          {saved && <span style={{ fontSize: 12, color: brand.success }}>Saved!</span>}
          <OButton variant="gold" onClick={() => void handleSave()} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Access Config'}
          </OButton>
        </div>
      </div>
    </OCard>
  );
}

type CancellationPolicy = {
  booking_cancel_window_hours: number;
  booking_cancel_fee_cents: number;
  membership_cancel_notice_days: number;
};

const DEFAULTS: CancellationPolicy = {
  booking_cancel_window_hours: 24,
  booking_cancel_fee_cents: 0,
  membership_cancel_notice_days: 30,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: brand.textMuted,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 5,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: `1px solid ${brand.border}`,
  borderRadius: 7,
  fontSize: 13,
  color: brand.text,
  background: brand.surface,
  fontFamily: fonts.body,
  outline: 'none',
  boxSizing: 'border-box',
};

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

export function SettingsContent() {
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error } = await (supabase as unknown as import('@supabase/supabase-js').SupabaseClient)
          .from('tenant_config')
          .select(
            'booking_cancel_window_hours, booking_cancel_fee_cents, membership_cancel_notice_days',
          )
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setPolicy({
            booking_cancel_window_hours: (data as CancellationPolicy).booking_cancel_window_hours ?? 24,
            booking_cancel_fee_cents: (data as CancellationPolicy).booking_cancel_fee_cents ?? 0,
            membership_cancel_notice_days:
              (data as CancellationPolicy).membership_cancel_notice_days ?? 30,
          });
        }
      } catch (err) {
        console.error('[settings] load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setToast({ msg: 'Cancellation policy saved.', kind: 'success' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setToast({ msg, kind: 'error' });
    } finally {
      setSaving(false);
    }
  }, [policy]);

  const numField = (
    key: keyof CancellationPolicy,
    min: number,
    max: number,
  ) => (
    <input
      type="number"
      min={min}
      max={max}
      style={inputStyle}
      value={policy[key]}
      onChange={(e) =>
        setPolicy((p) => ({
          ...p,
          [key]: Math.max(min, Math.min(max, parseInt(e.target.value, 10) || 0)),
        }))
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Cancellation policies, staff access profiles, and location configuration."
      />

      <div style={{ padding: '28px 32px' }}>
        <OCard>
          <div style={{ padding: '4px 4px 8px' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                fontFamily: fonts.display,
                color: brand.text,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Cancellation Policy
            </div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 20 }}>
              These settings apply to all parents booking through Clubhouse by Infinite Hitting.
              Changes take effect immediately — no redeploy required.
            </div>

            {loading ? (
              <div style={{ fontSize: 12, color: brand.textMuted }}>Loading…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
                <FieldGroup
                  label="Session cancellation window (hours)"
                  hint="Cancellations within this window show a policy warning to the parent."
                >
                  {numField('booking_cancel_window_hours', 0, 168)}
                </FieldGroup>

                <FieldGroup
                  label="Late cancellation fee ($)"
                  hint="Informational only — staff collect at the front desk. Enter 0 for no fee."
                >
                  <div style={{ position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 11,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 13,
                        color: brand.textMuted,
                        pointerEvents: 'none',
                      }}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={50000}
                      step={100}
                      style={{ ...inputStyle, paddingLeft: 22 }}
                      value={(policy.booking_cancel_fee_cents / 100).toFixed(2)}
                      onChange={(e) => {
                        const dollars = parseFloat(e.target.value) || 0;
                        setPolicy((p) => ({
                          ...p,
                          booking_cancel_fee_cents: Math.round(Math.max(0, dollars) * 100),
                        }));
                      }}
                    />
                  </div>
                </FieldGroup>

                <FieldGroup
                  label="Membership cancellation notice (days)"
                  hint="Minimum notice period before a membership cancellation takes effect."
                >
                  {numField('membership_cancel_notice_days', 0, 90)}
                </FieldGroup>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <OButton
                variant="gold"
                onClick={() => void handleSave()}
                disabled={saving || loading}
              >
                {saving ? 'Saving…' : 'Save Policy'}
              </OButton>
            </div>
          </div>
        </OCard>

        <StaffAccessPanel />
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 500,
            background: toast.kind === 'success' ? brand.dark : brand.dangerBg,
            color: toast.kind === 'success' ? brand.gold : brand.danger,
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.24)',
            fontSize: 13,
            fontWeight: 600,
            border: `1px solid ${toast.kind === 'success' ? brand.border : brand.danger}`,
            maxWidth: 380,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
