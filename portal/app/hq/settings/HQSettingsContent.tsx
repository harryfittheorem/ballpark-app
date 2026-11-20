'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { Settings, Globe, Percent, Loader2, CheckCircle2, Save } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  royaltyRate: number;
}

interface HQSettingsData {
  network_logo_url: string | null;
  network_favicon_url: string | null;
}

interface Props {
  settings: HQSettingsData;
  tenants: Tenant[];
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

function SectionCard({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`,
      marginBottom: 20, overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${brand.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon size={16} color={brand.goldDeep} />
        <span style={{ fontSize: 14, fontWeight: 700, color: brand.text, fontFamily: fonts.display }}>
          {title}
        </span>
      </div>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}

export function HQSettingsContent({ settings, tenants }: Props) {
  const router = useRouter();

  const [branding, setBranding] = useState({
    networkLogoUrl: settings.network_logo_url ?? '',
    networkFaviconUrl: settings.network_favicon_url ?? '',
  });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  const [royaltyRates, setRoyaltyRates] = useState<Record<string, string>>(
    Object.fromEntries(tenants.map(t => [t.id, (t.royaltyRate * 100).toFixed(2)]))
  );
  const [royaltySaving, setRoyaltySaving] = useState<string | null>(null);
  const [royaltySaved, setRoyaltySaved] = useState<string | null>(null);
  const [royaltyError, setRoyaltyError] = useState<Record<string, string>>({});

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setBrandingSaving(true);
    setBrandingError(null);
    setBrandingSaved(false);
    try {
      const res = await fetch('/api/hq/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'branding',
          networkLogoUrl: branding.networkLogoUrl || null,
          networkFaviconUrl: branding.networkFaviconUrl || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to save');
      setBrandingSaved(true);
      router.refresh();
      setTimeout(() => setBrandingSaved(false), 3000);
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBrandingSaving(false);
    }
  }

  async function saveRoyalty(tenantId: string) {
    const rateStr = royaltyRates[tenantId] ?? '';
    const rate = parseFloat(rateStr) / 100;
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setRoyaltyError(prev => ({ ...prev, [tenantId]: 'Enter a valid percentage (0–100)' }));
      return;
    }
    setRoyaltySaving(tenantId);
    setRoyaltyError(prev => ({ ...prev, [tenantId]: '' }));
    setRoyaltySaved(null);
    try {
      const res = await fetch('/api/hq/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'royalty', tenantId, rate }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Failed to save');
      setRoyaltySaved(tenantId);
      router.refresh();
      setTimeout(() => setRoyaltySaved(null), 3000);
    } catch (err) {
      setRoyaltyError(prev => ({ ...prev, [tenantId]: err instanceof Error ? err.message : 'Unknown error' }));
    } finally {
      setRoyaltySaving(null);
    }
  }

  return (
    <div style={{ padding: 28, maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Settings size={22} color={brand.goldDeep} />
        <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: 0, letterSpacing: 0.5 }}>
          Settings
        </h1>
      </div>
      <p style={{ color: brand.textMuted, fontSize: 14, marginBottom: 32 }}>
        Global HQ configuration for the Clubhouse by Infinite Hitting network.
      </p>

      {/* Network Branding */}
      <SectionCard title="Network Branding" icon={Globe}>
        <form onSubmit={saveBranding}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Network Logo URL</label>
            <input
              style={inputStyle}
              type="url"
              placeholder="https://example.com/logo.png"
              value={branding.networkLogoUrl}
              onChange={e => setBranding(prev => ({ ...prev, networkLogoUrl: e.target.value }))}
            />
            <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>
              Full URL to the network-wide logo image (PNG or SVG, recommended 200×60px).
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Network Favicon URL</label>
            <input
              style={inputStyle}
              type="url"
              placeholder="https://example.com/favicon.ico"
              value={branding.networkFaviconUrl}
              onChange={e => setBranding(prev => ({ ...prev, networkFaviconUrl: e.target.value }))}
            />
            <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>
              Full URL to the favicon (ICO or PNG, 32×32px).
            </div>
          </div>

          {brandingError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: brand.dangerBg, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
              {brandingError}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="submit"
              disabled={brandingSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: brand.gold, color: brand.darker,
                fontSize: 13, fontWeight: 700,
                cursor: brandingSaving ? 'not-allowed' : 'pointer',
                opacity: brandingSaving ? 0.7 : 1,
              }}
            >
              {brandingSaving ? <Loader2 size={13} /> : <Save size={13} />}
              Save Branding
            </button>
            {brandingSaved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: brand.success, fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        </form>
      </SectionCard>

      {/* Royalty Rates */}
      <SectionCard title="Royalty Rates per Franchise" icon={Percent}>
        <p style={{ fontSize: 13, color: brand.textMuted, margin: '0 0 20px' }}>
          Set the royalty rate (%) applied to each franchise&apos;s transaction volume. Changes take effect on the next billing cycle.
        </p>

        {tenants.length === 0 ? (
          <p style={{ color: brand.textMuted, fontSize: 13 }}>No franchises found.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${brand.border}` }}>
                {['Franchise', 'Slug', 'Royalty Rate', ''].map(h => (
                  <th key={h} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: 11, fontWeight: 700, color: brand.textMuted,
                    letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < tenants.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: brand.text }}>{t.name}</td>
                  <td style={{ padding: '10px 12px', color: brand.textMuted, fontSize: 12 }}>{t.slug}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={royaltyRates[t.id] ?? '2.50'}
                        onChange={e => setRoyaltyRates(prev => ({ ...prev, [t.id]: e.target.value }))}
                      />
                      <span style={{ fontSize: 13, color: brand.textMuted }}>%</span>
                    </div>
                    {royaltyError[t.id] && (
                      <div style={{ fontSize: 11, color: brand.danger, marginTop: 4 }}>{royaltyError[t.id]}</div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => saveRoyalty(t.id)}
                        disabled={royaltySaving === t.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '6px 14px', borderRadius: 7, border: 'none',
                          background: brand.goldDeep + '22', color: brand.goldDeep,
                          fontSize: 12, fontWeight: 700,
                          cursor: royaltySaving === t.id ? 'not-allowed' : 'pointer',
                          opacity: royaltySaving === t.id ? 0.6 : 1,
                        }}
                      >
                        {royaltySaving === t.id ? <Loader2 size={11} /> : <Save size={11} />}
                        Save
                      </button>
                      {royaltySaved === t.id && (
                        <CheckCircle2 size={14} color={brand.success} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
