'use client';

import { usePathname, useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  LayoutDashboard, Users, Calendar, CreditCard, TrendingDown, TrendingUp,
  UserCog, Sparkles, AlertCircle, Clock, AlertTriangle, BarChart3,
  ChevronLeft, ChevronRight, Building2, Dumbbell, ClipboardCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const ownerNav: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard',   href: '/owner',             icon: LayoutDashboard },
      { label: 'Members CRM', href: '/owner/members',      icon: Users },
      { label: 'Schedule',    href: '/owner/schedule',     icon: Calendar },
      { label: 'Check-In',    href: '/admin/check-in',     icon: ClipboardCheck },
      { label: 'Coaches',     href: '/owner/coaches',      icon: UserCog },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { label: 'Billing', href: '/owner/billing', icon: CreditCard },
      { label: 'Failed Payments', href: '/owner/failed-payments', icon: AlertCircle },
      { label: 'Revenue Reports', href: '/owner/revenue-reports', icon: BarChart3 },
    ],
  },
  {
    label: 'Retention',
    items: [
      { label: 'Retention', href: '/owner/retention', icon: TrendingUp },
      { label: 'Missing in Action', href: '/owner/missing-in-action', icon: Clock },
      { label: 'At-Risk', href: '/owner/at-risk', icon: AlertTriangle },
      { label: 'Churn Analysis', href: '/owner/churn-analysis', icon: TrendingDown },
    ],
  },
  {
    label: 'Config',
    items: [
      { label: 'Points & Rewards', href: '/owner/points-rewards', icon: Sparkles },
      { label: 'Payments',         href: '/owner/payments',       icon: CreditCard },
    ],
  },
];

const franchisorNav: NavSection[] = [
  {
    label: 'Network',
    items: [
      { label: 'Overview', href: '/owner/franchisor', icon: LayoutDashboard },
      { label: 'Location Detail', href: '/owner/franchisor/1', icon: Building2 },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'Retention', href: '/owner/retention', icon: TrendingUp },
      { label: 'Churn Analysis', href: '/owner/churn-analysis', icon: TrendingDown },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  role: 'owner' | 'franchisor';
}

export function Sidebar({ collapsed, onToggle, role }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const width = collapsed ? 68 : 220;
  const sections = role === 'franchisor' ? franchisorNav : ownerNav;

  const isActive = (href: string) => {
    if (href === '/owner') return pathname === '/owner';
    if (href === '/owner/franchisor') return pathname === '/owner/franchisor';
    return pathname.startsWith(href);
  };

  return (
    <div style={{
      width, minWidth: width, height: '100%',
      background: brand.dark, color: brand.cream,
      display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${brand.darker}`,
      transition: 'width 0.2s',
      overflow: 'hidden',
    }}>
      <div style={{ padding: collapsed ? '16px 12px' : '20px 16px', borderBottom: `1px solid ${brand.borderDark}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Dumbbell size={18} color={brand.dark} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 1.5, fontFamily: fonts.display, whiteSpace: 'nowrap' }}>INFINITE HITTING</div>
            <div style={{ fontSize: 9, color: brand.textLight, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Operations Portal</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 0' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 16 }}>
            {section.label && !collapsed && (
              <div style={{ fontSize: 9, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, padding: '0 20px 6px', textTransform: 'uppercase', fontFamily: fonts.display }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <div
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: collapsed ? '10px 22px' : '9px 20px',
                    cursor: 'pointer',
                    background: active ? `${brand.gold}15` : 'transparent',
                    color: active ? brand.gold : brand.cream,
                    borderLeft: active ? `3px solid ${brand.gold}` : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <item.icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <>
                      <div style={{ fontSize: 13, fontWeight: active ? 700 : 500, flex: 1, whiteSpace: 'nowrap' }}>{item.label}</div>
                      {item.badge !== undefined && (
                        <div style={{ fontSize: 9, fontWeight: 800, background: brand.danger, color: brand.white, padding: '2px 6px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>
                          {item.badge}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div
        onClick={onToggle}
        style={{ padding: 12, borderTop: `1px solid ${brand.borderDark}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 11, color: brand.textLight }}
      >
        {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
      </div>
    </div>
  );
}
