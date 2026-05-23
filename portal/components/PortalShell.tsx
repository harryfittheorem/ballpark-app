'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  LayoutDashboard, Users, Calendar, CreditCard, TrendingDown, TrendingUp,
  UserCog, Sparkles, AlertCircle, Clock, AlertTriangle, BarChart3,
  MessageSquare, BookOpen, Video, Settings, ChevronLeft, ChevronRight,
  Menu, X, LogOut, ClipboardCheck, ClipboardList,
} from 'lucide-react';
import { signOut } from '@/app/login/actions';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

const COACH_NAV: NavSection[] = [
  {
    items: [
      { label: 'Inbox', href: '/coach/inbox', icon: MessageSquare },
      { label: 'My Sessions', href: '/coach/sessions', icon: ClipboardCheck },
      { label: 'Assignments', href: '/coach/assignments', icon: BookOpen },
    ],
  },
];

const ADMIN_NAV: NavSection[] = [
  {
    items: [
      { label: 'Check-In', href: '/admin/check-in', icon: ClipboardCheck },
      { label: 'Redemptions', href: '/admin/redemptions', icon: Sparkles },
      { label: 'Training Videos', href: '/admin/training-videos', icon: Video },
      { label: 'Messages', href: '/admin/messages', icon: MessageSquare },
      { label: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];

const OWNER_NAV: NavSection[] = [
  {
    label: 'Operations',
    items: [
      { label: 'Dashboard', href: '/owner', icon: LayoutDashboard },
      { label: 'Members', href: '/owner/members', icon: Users },
      { label: 'Schedule', href: '/owner/schedule', icon: Calendar },
      { label: 'Coaches', href: '/owner/coaches', icon: UserCog },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { label: 'Billing', href: '/owner/billing', icon: CreditCard },
      { label: 'Failed Payments', href: '/owner/failed-payments', icon: AlertCircle },
      { label: 'Revenue Reports', href: '/owner/revenue-reports', icon: BarChart3 },
      { label: 'Coach Hours', href: '/owner/coach-hours', icon: ClipboardList },
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
      { label: 'Payments', href: '/owner/payments', icon: CreditCard },
      { label: 'Settings', href: '/owner/settings', icon: Settings },
    ],
  },
];

const FRANCHISOR_NAV: NavSection[] = [
  {
    label: 'Network',
    items: [
      { label: 'Overview', href: '/owner/franchisor', icon: LayoutDashboard },
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

function isActive(pathname: string, href: string): boolean {
  if (href === '/owner') return pathname === '/owner';
  if (href === '/owner/franchisor') return pathname === '/owner/franchisor';
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface PortalShellProps {
  children: ReactNode;
  role: 'coach' | 'admin' | 'owner';
  email?: string | null;
  userName?: string;
  locationName?: string;
}

export function PortalShell({
  children,
  role,
  email,
  userName,
  locationName,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ownerSubRole, setOwnerSubRole] = useState<'owner' | 'franchisor'>(
    pathname?.startsWith('/owner/franchisor') ? 'franchisor' : 'owner',
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sections =
    role === 'owner'
      ? ownerSubRole === 'franchisor'
        ? FRANCHISOR_NAV
        : OWNER_NAV
      : role === 'coach'
        ? COACH_NAV
        : ADMIN_NAV;

  const homeHref =
    role === 'coach' ? '/coach/inbox' : role === 'admin' ? '/admin' : '/owner';

  const displayName = userName ?? email ?? (role === 'owner' ? 'Owner' : role === 'coach' ? 'Coach' : 'Admin');
  const initial = displayName.charAt(0).toUpperCase();

  const SidebarContent = (
    <div
      className={[
        'flex h-full flex-col bg-darker border-r border-border-gold transition-[width] duration-200 overflow-hidden',
        collapsed ? 'w-[68px]' : 'w-[220px]',
      ].join(' ')}
    >
      {/* Logo */}
      <div
        className={[
          'flex items-center border-b border-border-gold flex-shrink-0',
          collapsed ? 'justify-center px-3 py-4' : 'gap-2.5 px-4 py-5',
        ].join(' ')}
      >
        <Link href={homeHref} className="flex items-center gap-2.5 group">
          <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gold shadow-[0_0_12px_rgba(241,229,173,0.7)] transition-transform group-hover:scale-110" />
          {!collapsed && (
            <span className="font-display text-xl font-semibold uppercase tracking-[0.18em] text-cream-light whitespace-nowrap">
              Ball<span className="text-gold">park</span>
            </span>
          )}
        </Link>
      </div>

      {/* Role badge + owner role switcher */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-2 flex-shrink-0 space-y-2">
          <span className="inline-flex rounded-full border border-border-gold-strong bg-darkest px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            {role === 'owner' ? ownerSubRole : role}
          </span>
          {role === 'owner' && (
            <div className="flex gap-1 rounded-lg border border-border-gold bg-darkest p-1">
              {(['owner', 'franchisor'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setOwnerSubRole(r);
                    router.push(r === 'franchisor' ? '/owner/franchisor' : '/owner');
                  }}
                  className={[
                    'flex-1 rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-all',
                    ownerSubRole === r
                      ? 'bg-darker text-gold'
                      : 'text-text-light hover:text-cream-light',
                  ].join(' ')}
                >
                  {r === 'owner' ? 'Owner' : 'Franchisor'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 min-h-0">
        {sections.map((section, si) => (
          <div key={si} className="mb-4">
            {section.label && !collapsed && (
              <div className="px-5 pb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-text-light">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname ?? '', item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-2.5 border-l-[3px] py-2.5 transition-all',
                    collapsed ? 'justify-center px-[22px]' : 'px-5',
                    active
                      ? 'border-gold bg-gold/10 text-gold'
                      : 'border-transparent text-text-light hover:bg-darkest/60 hover:text-cream-light',
                  ].join(' ')}
                >
                  <item.icon size={16} strokeWidth={2.2} className="flex-shrink-0" />
                  {!collapsed && (
                    <span
                      className={[
                        'text-[13px] whitespace-nowrap',
                        active ? 'font-bold' : 'font-medium',
                      ].join(' ')}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="hidden md:flex items-center justify-center gap-1.5 border-t border-border-gold px-3 py-3 text-[11px] text-text-light hover:text-cream-light transition-colors flex-shrink-0"
      >
        {collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <>
            <ChevronLeft size={14} />
            <span>Collapse</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-darkest">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full flex-col flex-shrink-0">
        {SidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex h-full w-[220px] flex-col">
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="flex h-14 flex-shrink-0 items-center justify-between gap-3 border-b border-border-gold bg-darker px-4">
          {/* Hamburger (mobile only) */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden rounded-lg p-1.5 text-text-light hover:text-cream-light transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex-1" />

          {/* User info + avatar + sign out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold/20 border border-border-gold text-sm font-bold text-gold font-display">
                {initial}
              </div>
              <div className="hidden sm:block text-right leading-tight">
                {locationName && (
                  <div className="text-[10px] text-text-light truncate max-w-[160px]">
                    {locationName}
                  </div>
                )}
                {email && (
                  <div className="text-[11px] text-text-light/80 truncate max-w-[160px]">
                    {email}
                  </div>
                )}
              </div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg border border-border-gold bg-darkest px-3 py-1.5 text-xs font-medium text-cream transition-colors hover:border-gold hover:text-gold"
              >
                <LogOut size={12} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}
