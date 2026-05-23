'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import type { HQLocation } from '@/lib/supabase/hqQueries';

interface Props {
  location: HQLocation;
  onClose: () => void;
}

const US_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

export function HQEditLocationModal({ location, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: location.name,
    address: location.address ?? '',
    city: location.city ?? '',
    state: location.state ?? '',
    zip: location.zip ?? '',
    phone: location.phone ?? '',
    email: location.email ?? '',
    timezone: location.timezone ?? 'America/Chicago',
    isActive: location.isActive,
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/hq/locations/${location.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to update location');
      setSuccess(true);
      router.refresh();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 7,
    border: `1px solid ${brand.border}`, background: brand.surfaceAlt,
    fontSize: 13, color: brand.text, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: brand.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 14, width: 520,
        maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${brand.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: fonts.display, color: brand.text }}>
              Edit Location
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: brand.textMuted }}>
              {location.tenantName} · {location.tenantSlug}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={brand.textMuted} />
          </button>
        </div>

        {success ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={40} color={brand.success} style={{ marginBottom: 12 }} />
            <p style={{ color: brand.text, fontWeight: 600, margin: 0 }}>Location updated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: 24 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Location Name *</label>
              <input
                style={inputStyle} required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Dallas North"
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Address</label>
              <input
                style={inputStyle}
                value={form.address}
                onChange={e => set('address', e.target.value)}
                placeholder="123 Main St"
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>City</label>
                <input
                  style={inputStyle}
                  value={form.city}
                  onChange={e => set('city', e.target.value)}
                  placeholder="Dallas"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>State</label>
                <input
                  style={inputStyle}
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  placeholder="TX"
                  maxLength={2}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>ZIP</label>
                <input
                  style={inputStyle}
                  value={form.zip}
                  onChange={e => set('zip', e.target.value)}
                  placeholder="75001"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Phone</label>
                <input
                  style={inputStyle}
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Email</label>
                <input
                  style={inputStyle}
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="info@location.com"
                />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Timezone</label>
              <select
                style={{ ...inputStyle, appearance: 'none' }}
                value={form.timezone}
                onChange={e => set('timezone', e.target.value)}
              >
                {US_TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz.replace('America/', '').replace('Pacific/', '').replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Active toggle */}
            <div style={{
              padding: '14px 16px', borderRadius: 8,
              background: form.isActive ? brand.successBg : brand.dangerBg,
              border: `1px solid ${form.isActive ? brand.success + '40' : brand.danger + '40'}`,
              marginBottom: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: form.isActive ? brand.success : brand.danger }}>
                  {form.isActive ? 'Location Active' : 'Location Inactive'}
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>
                  {form.isActive
                    ? 'This location appears in booking flows.'
                    : 'Inactive locations are hidden from booking flows.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => set('isActive', !form.isActive)}
                style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  border: 'none',
                  background: form.isActive ? brand.danger : brand.success,
                  color: '#fff', cursor: 'pointer',
                }}
              >
                {form.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: brand.dangerBg, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button" onClick={onClose}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: `1px solid ${brand.border}`,
                  background: 'transparent', color: brand.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: brand.gold, color: brand.darker,
                  fontSize: 13, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading && <Loader2 size={13} />}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
