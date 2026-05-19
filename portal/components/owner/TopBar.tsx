'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  Search, Bell, ChevronDown, LogOut, User, X,
  AlertCircle, AlertTriangle, Calendar, CheckCircle2,
} from 'lucide-react';

interface TopBarProps {
  role: 'owner' | 'franchisor';
  onRoleChange: (role: 'owner' | 'franchisor') => void;
  userName?: string;
  locationName?: string;
}

const NOTIFICATIONS = [
  { id: 1, Icon: AlertCircle,  color: brand.danger,  text: '3 failed payments need attention',  sub: '2 min ago', link: '/owner/failed-payments' },
  { id: 2, Icon: AlertTriangle,color: brand.warning, text: '8 members flagged as at-risk',       sub: '1 hr ago',  link: '/owner/at-risk' },
  { id: 3, Icon: Calendar,     color: brand.info,    text: '20 sessions booked for today',        sub: '3 hrs ago', link: '/owner/schedule' },
  { id: 4, Icon: CheckCircle2, color: brand.success, text: '$4,200 collected today',              sub: 'Today',     link: '/owner/billing' },
];

const SEARCH_LINKS = [
  { label: 'Members',          sub: 'View all members & subscriptions', path: '/owner/members' },
  { label: 'Schedule',         sub: 'Today\'s bookings & cage grid',     path: '/owner/schedule' },
  { label: 'Coaches',          sub: 'Coach roster & performance',         path: '/owner/coaches' },
  { label: 'Billing',          sub: 'Revenue, MRR, auto-collect',         path: '/owner/billing' },
  { label: 'Revenue Reports',  sub: 'EFT vs OTC, cohort data',            path: '/owner/revenue-reports' },
  { label: 'Failed Payments',  sub: 'Recover missed charges',             path: '/owner/failed-payments' },
  { label: 'At-Risk Members',  sub: 'Churn prevention',                   path: '/owner/at-risk' },
  { label: 'Points & Rewards', sub: 'Redemptions & leaderboard',          path: '/owner/points-rewards' },
];

export function TopBar({ role, onRoleChange, userName = 'Owner', locationName = 'Your Location' }: TopBarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bellOpen,   setBellOpen]     = useState(false);
  const [userOpen,   setUserOpen]     = useState(false);
  const [bellRead,   setBellRead]     = useState(false);
  const bellRef      = useRef<HTMLDivElement>(null);
  const userRef      = useRef<HTMLDivElement>(null);
  const searchInput  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
      if (e.key === 'Escape') { setSearchOpen(false); setBellOpen(false); setUserOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) { setTimeout(() => searchInput.current?.focus(), 40); }
    else { setSearchQuery(''); }
  }, [searchOpen]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleRoleChange = (newRole: 'owner' | 'franchisor') => {
    onRoleChange(newRole);
    router.push(newRole === 'franchisor' ? '/owner/franchisor' : '/owner');
  };

  const filtered = searchQuery.trim()
    ? SEARCH_LINKS.filter(l =>
        l.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.sub.toLowerCase().includes(searchQuery.toLowerCase()))
    : SEARCH_LINKS;

  const go = (path: string) => { setSearchOpen(false); router.push(path); };

  const pill: React.CSSProperties = {
    padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
    borderRadius: 5, fontFamily: fonts.display, letterSpacing: 0.5,
    textTransform: 'uppercase', transition: 'all 0.15s',
  };

  const dropItem: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
    cursor: 'pointer', fontSize: 12, transition: 'background 0.1s',
  };

  return (
    <>
      <div style={{
        height: 60, background: brand.surface, borderBottom: `1px solid ${brand.border}`,
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
        flexShrink: 0, position: 'relative', zIndex: 10,
      }}>

        {/* Search trigger */}
        <div
          onClick={() => setSearchOpen(true)}
          style={{
            flex: 1, maxWidth: 480, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', background: brand.surfaceAlt, borderRadius: 8,
            border: `1px solid ${brand.border}`, cursor: 'pointer', transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = brand.goldDeep; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = brand.border; }}
        >
          <Search size={14} color={brand.textMuted} />
          <div style={{ flex: 1, fontSize: 13, color: brand.textMuted }}>Search members, payments, sessions...</div>
          <div style={{ fontSize: 10, color: brand.textMuted, background: brand.white, padding: '2px 6px', borderRadius: 4, fontFamily: fonts.mono, fontWeight: 600 }}>⌘K</div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Role switcher */}
        <div style={{ display: 'flex', gap: 4, background: brand.surfaceAlt, padding: 3, borderRadius: 8, border: `1px solid ${brand.border}` }}>
          {(['owner', 'franchisor'] as const).map(r => (
            <div
              key={r}
              onClick={() => handleRoleChange(r)}
              style={{
                ...pill,
                background: role === r ? brand.dark : 'transparent',
                color:      role === r ? brand.gold  : brand.textMuted,
              }}
            >
              {r === 'owner' ? 'Owner' : 'Franchisor'}
            </div>
          ))}
        </div>

        {/* Bell */}
        <div ref={bellRef} style={{ position: 'relative' }}>
          <div
            onClick={() => { setBellOpen(o => !o); setBellRead(true); setUserOpen(false); }}
            style={{
              position: 'relative', cursor: 'pointer', padding: 6, borderRadius: 8,
              background: bellOpen ? brand.surfaceAlt : 'transparent', transition: 'background 0.15s',
            }}
          >
            <Bell size={18} color={bellOpen ? brand.goldDeep : brand.textMuted} />
            {!bellRead && (
              <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, background: brand.danger }} />
            )}
          </div>
          {bellOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320,
              background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${brand.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase' }}>Notifications</span>
                <span style={{ fontSize: 11, color: brand.textMuted }}>Today</span>
              </div>
              {NOTIFICATIONS.map(({ id, Icon, color, text, sub, link }) => (
                <div
                  key={id}
                  onClick={() => { setBellOpen(false); router.push(link); }}
                  style={{ display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: `1px solid ${brand.border}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = brand.surfaceAlt; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: brand.text, lineHeight: 1.4 }}>{text}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{sub}</div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                <span
                  onClick={() => { setBellOpen(false); router.push('/owner'); }}
                  style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700, cursor: 'pointer' }}
                >
                  View Dashboard →
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div ref={userRef} style={{ position: 'relative' }}>
          <div
            onClick={() => { setUserOpen(o => !o); setBellOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              paddingLeft: 12, borderLeft: `1px solid ${brand.border}`,
              padding: '6px 6px 6px 12px', borderRadius: 8,
              background: userOpen ? brand.surfaceAlt : 'transparent', transition: 'background 0.15s',
            }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 16, background: brand.dark, color: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, fontFamily: fonts.display }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: brand.text }}>{userName}</div>
              <div style={{ fontSize: 10, color: brand.textMuted }}>{role === 'franchisor' ? 'All 17 Locations' : locationName}</div>
            </div>
            <ChevronDown size={14} color={brand.textMuted} style={{ transform: userOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </div>
          {userOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 210,
              background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${brand.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{userName}</div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{locationName}</div>
              </div>
              <div
                onClick={() => { setUserOpen(false); router.push('/owner'); }}
                style={dropItem}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = brand.surfaceAlt; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <User size={14} color={brand.textMuted} />
                Dashboard
              </div>
              <div
                onClick={() => { setUserOpen(false); window.location.href = '/logout'; }}
                style={{ ...dropItem, color: brand.danger, borderTop: `1px solid ${brand.border}` }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = brand.dangerBg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <LogOut size={14} />
                Sign out
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search modal */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 110 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: 560, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.24)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${brand.border}` }}>
              <Search size={16} color={brand.textMuted} />
              <input
                ref={searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && filtered.length > 0) go(filtered[0].path); }}
                placeholder="Search pages, members, payments..."
                className="search-modal-input"
                style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: brand.text, background: 'transparent', fontFamily: fonts.body }}
              />
              <div onClick={() => setSearchOpen(false)} style={{ cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                <X size={14} color={brand.textMuted} />
              </div>
            </div>
            <div style={{ maxHeight: 340, overflow: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>No results for &ldquo;{searchQuery}&rdquo;</div>
              ) : filtered.map(l => (
                <div
                  key={l.path}
                  onClick={() => go(l.path)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', cursor: 'pointer', borderBottom: `1px solid ${brand.border}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = brand.surfaceAlt; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                >
                  <Search size={13} color={brand.textMuted} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{l.sub}</div>
                  </div>
                  <span style={{ fontSize: 11, color: brand.textMuted, fontFamily: fonts.mono }}>↵</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '8px 18px', borderTop: `1px solid ${brand.border}`, display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 11, color: brand.textMuted, fontFamily: fonts.mono }}>↵ navigate</span>
              <span style={{ fontSize: 11, color: brand.textMuted, fontFamily: fonts.mono }}>ESC close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
