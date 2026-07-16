'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { HQLocation } from '@/lib/supabase/hqQueries';

interface Props {
  onClose: () => void;
  locations: HQLocation[];
}

type Role = 'coach' | 'admin' | 'owner' | 'super_admin';

export function HQInviteModal({ onClose, locations }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'coach' as Role,
    tenantSlug: '',
    locationId: '',
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleTenantChange = (slug: string) =>
    setForm(prev => ({ ...prev, tenantSlug: slug, locationId: '' }));

  const tenantLocations = locations.filter(l => l.tenantSlug === form.tenantSlug);
  const tenants = Array.from(
    new Map(locations.map(l => [l.tenantSlug, l.tenantName])).entries()
  ).map(([slug, name]) => ({ slug, name }));

  const isSuperAdmin = form.role === 'super_admin';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Show confirmation step for super_admin role.
    if (isSuperAdmin && !confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    try {
      if (isSuperAdmin) {
        const res = await fetch('/api/hq/invite/superadmin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            firstName: form.firstName,
            lastName: form.lastName,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Failed to send invite');
      } else {
        const payload: Record<string, string> = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          role: form.role,
          tenantSlug: form.tenantSlug,
        };
        if (form.role === 'coach' && form.locationId) {
          payload.locationId = form.locationId;
        }
        const res = await fetch('/api/hq/invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'Failed to send invite');
      }
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 7,
    border: `1px solid ${brand.border}`, background: brand.surface,
    fontSize: 13, color: brand.text, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: brand.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8,
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 14, width: 480,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${brand.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: fonts.display, color: brand.text }}>
            Invite Team Member
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={brand.textMuted} />
          </button>
        </div>

        {success ? (
          <div style={{
            padding: 40,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <CheckCircle2 size={48} color={brand.success} style={{ display: 'block', marginBottom: 16, flexShrink: 0, alignSelf: 'center' }} />
            <h3 style={{ fontFamily: fonts.display, fontSize: 18, fontWeight: 800, color: brand.text, margin: '0 0 8px' }}>
              Invite sent!
            </h3>
            <p style={{ fontFamily: fonts.body, color: brand.textMuted, fontSize: 13, margin: '0 0 24px', lineHeight: 1.5 }}>
              An email has been sent to <strong style={{ color: brand.text }}>{form.email}</strong> with instructions to activate their account.
            </p>
            <button
              onClick={onClose}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: brand.gold, color: brand.darker, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.display }}
            >
              Done
            </button>
          </div>
        ) : confirming ? (
          /* Confirmation step for super_admin */
          <div style={{ padding: 28 }}>
            <div style={{
              padding: '14px 16px', borderRadius: 9,
              background: brand.warningBg, border: `1px solid ${brand.warning}40`,
              display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 22,
            }}>
              <AlertTriangle size={18} color={brand.warning} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: brand.warning, marginBottom: 4 }}>
                  Full network access
                </div>
                <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>
                  This role gives <strong>{form.firstName} {form.lastName}</strong> complete access to all
                  franchise locations, financial data, and administrative controls across the entire Ballpark network.
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: brand.text, margin: '0 0 20px' }}>
              Send a super admin invitation to <strong>{form.email}</strong>?
            </p>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: brand.dangerBg, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${brand.border}`, background: 'transparent', color: brand.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Back
              </button>
              <button
                onClick={handleSubmit as unknown as React.MouseEventHandler}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: brand.gold, color: brand.darker,
                  fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading && <Loader2 size={13} />}
                Yes, Send Invite
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name *</label>
                <input style={inputStyle} required value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Mike" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last Name *</label>
                <input style={inputStyle} required value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Anderson" />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email *</label>
              <input
                style={inputStyle} type="email" required
                value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="coach@infinitehitting.com"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Role *</label>
              <select
                style={{ ...inputStyle, appearance: 'none' }}
                value={form.role}
                onChange={e => set('role', e.target.value as Role)}
              >
                <option value="coach">Coach</option>
                <option value="admin">Admin</option>
                <option value="owner">Owner</option>
                <option value="super_admin">HQ Admin</option>
              </select>
            </div>

            {/* HQ Admin notice */}
            {isSuperAdmin && (
              <div style={{
                padding: '10px 13px', borderRadius: 8, marginBottom: 14,
                background: brand.goldDeep + '14', border: `1px solid ${brand.goldDeep}30`,
                fontSize: 12, color: brand.goldDeep, lineHeight: 1.5,
              }}>
                HQ Admin gives full access to all franchise locations and the entire Ballpark network.
                A confirmation step will follow.
              </div>
            )}

            {/* Franchise + Location — not shown for HQ Admin */}
            {!isSuperAdmin && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>Franchise *</label>
                  <select
                    style={{ ...inputStyle, appearance: 'none' }}
                    required
                    value={form.tenantSlug}
                    onChange={e => handleTenantChange(e.target.value)}
                  >
                    <option value="">Select a franchise…</option>
                    {tenants.map(t => (
                      <option key={t.slug} value={t.slug}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {form.role === 'coach' && tenantLocations.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <label style={labelStyle}>Primary Location</label>
                    <select
                      style={{ ...inputStyle, appearance: 'none' }}
                      value={form.locationId}
                      onChange={e => set('locationId', e.target.value)}
                    >
                      <option value="">No specific location</option>
                      {tenantLocations.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>
                      The facility this coach will be based at.
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: brand.dangerBg, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button" onClick={onClose}
                style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${brand.border}`, background: 'transparent', color: brand.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: brand.gold, color: brand.darker,
                  fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading && <Loader2 size={13} />}
                {isSuperAdmin ? 'Continue →' : 'Send Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
