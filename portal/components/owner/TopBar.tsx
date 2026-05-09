'use client';

import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { demoData } from '@/lib/ownerDemoData';

interface TopBarProps {
  role: 'owner' | 'franchisor';
  onRoleChange: (role: 'owner' | 'franchisor') => void;
}

export function TopBar({ role, onRoleChange }: TopBarProps) {
  const router = useRouter();
  const user = role === 'franchisor' ? demoData.franchisor : demoData.owner;

  const handleRoleChange = (newRole: 'owner' | 'franchisor') => {
    onRoleChange(newRole);
    if (newRole === 'franchisor') {
      router.push('/owner/franchisor');
    } else {
      router.push('/owner');
    }
  };

  return (
    <div style={{
      height: 60, background: brand.surface, borderBottom: `1px solid ${brand.border}`,
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
      flexShrink: 0,
    }}>
      <div style={{ flex: 1, maxWidth: 480, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}` }}>
        <Search size={14} color={brand.textMuted} />
        <div style={{ flex: 1, fontSize: 13, color: brand.textMuted }}>Search members, payments, sessions...</div>
        <div style={{ fontSize: 10, color: brand.textMuted, background: brand.white, padding: '2px 6px', borderRadius: 4, fontFamily: fonts.mono, fontWeight: 600 }}>⌘K</div>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 4, background: brand.surfaceAlt, padding: 3, borderRadius: 8, border: `1px solid ${brand.border}` }}>
        {(['owner', 'franchisor'] as const).map(r => (
          <div
            key={r}
            onClick={() => handleRoleChange(r)}
            style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              background: role === r ? brand.dark : 'transparent',
              color: role === r ? brand.gold : brand.textMuted,
              borderRadius: 5, fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              transition: 'all 0.15s',
            }}
          >
            {r === 'owner' ? 'Owner' : 'Franchisor'}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative', cursor: 'pointer', padding: 6 }}>
        <Bell size={18} color={brand.textMuted} />
        <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, background: brand.danger }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', paddingLeft: 12, borderLeft: `1px solid ${brand.border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: fonts.display }}>
          {user.name.charAt(0)}
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: brand.text }}>{user.name}</div>
          <div style={{ fontSize: 10, color: brand.textMuted }}>{role === 'franchisor' ? 'All 17 Locations' : demoData.location.name}</div>
        </div>
        <ChevronDown size={14} color={brand.textMuted} />
      </div>
    </div>
  );
}
