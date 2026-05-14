'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { X, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function HQNewLocationModal({ onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    locationName: '',
    city: '',
    state: '',
    isNewTenant: true,
    existingTenantSlug: '',
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/hq/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to create location');
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 14, width: 520,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${brand.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: fonts.display, color: brand.text }}>
            New Location
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={brand.textMuted} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          {/* Tenant mode toggle */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Franchise</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: true, label: 'New Franchise' },
                { value: false, label: 'Existing Franchise' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => set('isNewTenant', opt.value)}
                  style={{
                    padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${form.isNewTenant === opt.value ? brand.goldDeep : brand.border}`,
                    background: form.isNewTenant === opt.value ? brand.goldDeep + '18' : 'transparent',
                    color: form.isNewTenant === opt.value ? brand.goldDeep : brand.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.isNewTenant ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Franchise Name *</label>
                <input
                  style={inputStyle} required value={form.tenantName}
                  onChange={e => set('tenantName', e.target.value)}
                  placeholder="e.g. Infinite Hitting Phoenix"
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>URL Slug *</label>
                <input
                  style={inputStyle} required value={form.tenantSlug}
                  onChange={e => set('tenantSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="e.g. infinitehitting-phoenix"
                />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Existing Franchise Slug *</label>
              <input
                style={inputStyle} required value={form.existingTenantSlug}
                onChange={e => set('existingTenantSlug', e.target.value)}
                placeholder="e.g. infinitehitting"
              />
            </div>
          )}

          <div style={{ height: 1, background: brand.border, margin: '16px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' }}>Location Details</div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Location Name *</label>
            <input
              style={inputStyle} required value={form.locationName}
              onChange={e => set('locationName', e.target.value)}
              placeholder="e.g. Dallas North"
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} value={form.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Dallas" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>State</label>
              <input style={inputStyle} value={form.state} onChange={e => set('state', e.target.value)} placeholder="TX" maxLength={2} />
            </div>
          </div>

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
              {loading && <Loader2 size={13} className="animate-spin" />}
              Create Location
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
