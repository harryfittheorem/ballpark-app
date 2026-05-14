import { Settings } from 'lucide-react';
import { brand, fonts } from '@/lib/ownerBrandTokens';

export default function HQSettingsPage() {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Settings size={22} color={brand.goldDeep} />
        <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: 0, letterSpacing: 0.5 }}>
          Settings
        </h1>
      </div>
      <p style={{ color: brand.textMuted, fontSize: 14, marginBottom: 32 }}>
        Global HQ configuration for the Ballpark network.
      </p>
      <div style={{
        background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`,
        padding: 40, textAlign: 'center', color: brand.textMuted,
      }}>
        <Settings size={36} color={brand.border} style={{ marginBottom: 12 }} />
        <p style={{ fontSize: 14, margin: 0 }}>Settings configuration coming soon.</p>
        <p style={{ fontSize: 12, margin: '6px 0 0', color: brand.textLight }}>
          Network-wide defaults, royalty rate overrides, and branding options will appear here.
        </p>
      </div>
    </div>
  );
}
