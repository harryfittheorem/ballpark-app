'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  MapPin, Users, DollarSign,
  Settings, ChevronLeft, ChevronRight, Globe2, LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const hqNav: NavItem[] = [
  { label: 'Locations', href: '/hq/locations', icon: MapPin },
  { label: 'Team', href: '/hq/team', icon: Users },
  { label: 'Revenue', href: '/hq/revenue', icon: DollarSign },
];

interface HQShellProps {
  children: ReactNode;
  email: string;
}

export function HQShell({ children, email }: HQShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const width = collapsed ? 68 : 220;

  const isActive = (href: string) => pathname?.startsWith(href);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', background: brand.cream, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width, minWidth: width, height: '100%',
        background: brand.darker, color: brand.cream,
        display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${brand.dark}`,
        transition: 'width 0.2s', overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 12px' : '20px 16px',
          borderBottom: `1px solid #2A2826`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, #F1E5AD, #B8A268)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Globe2 size={18} color={brand.darker} strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: brand.gold, letterSpacing: 2, fontFamily: fonts.display, whiteSpace: 'nowrap' }}>HQ CONSOLE</div>
              <div style={{ fontSize: 9, color: brand.textLight, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Super Admin</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {!collapsed && (
            <div style={{ fontSize: 9, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, padding: '0 20px 8px', textTransform: 'uppercase', fontFamily: fonts.display }}>
              Network
            </div>
          )}
          {hqNav.map(item => {
            const active = isActive(item.href);
            return (
              <div
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 22px' : '9px 20px',
                  cursor: 'pointer',
                  background: active ? `${brand.gold}18` : 'transparent',
                  color: active ? brand.gold : brand.cream,
                  borderLeft: active ? `3px solid ${brand.gold}` : '3px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <item.icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{item.label}</span>
                )}
              </div>
            );
          })}

          <div style={{ height: 1, background: '#2A2826', margin: '12px 0' }} />

          {/* Settings */}
          <div
            onClick={() => router.push('/hq/settings')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 22px' : '9px 20px',
              cursor: 'pointer',
              color: brand.textLight,
              borderLeft: '3px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <Settings size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            {!collapsed && <span style={{ fontSize: 13 }}>Settings</span>}
          </div>
        </div>

        {/* User + sign-out */}
        {!collapsed && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid #2A2826` }}>
            <div style={{ fontSize: 11, color: brand.textLight, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>
            <div
              onClick={() => router.push('/logout')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: brand.textLight, fontSize: 12 }}
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <div
          onClick={() => setCollapsed(c => !c)}
          style={{
            padding: 12, borderTop: `1px solid #2A2826`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, fontSize: 11, color: brand.textLight,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          height: 56, background: brand.surface,
          borderBottom: `1px solid ${brand.border}`,
          display: 'flex', alignItems: 'center',
          padding: '0 28px', flexShrink: 0,
          gap: 8,
        }}>
          <Globe2 size={16} color={brand.goldDeep} />
          <span style={{ fontSize: 13, color: brand.textMuted, fontFamily: fonts.body }}>
            Infinite Hitting HQ
          </span>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', background: brand.surfaceAlt }}>
          {children}
        </div>
      </div>
    </div>
  );
}
