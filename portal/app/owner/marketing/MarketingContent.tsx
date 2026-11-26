'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import { Megaphone, Calendar, ExternalLink, BookOpen, LineChart } from 'lucide-react';
import { AdsTab } from './AdsTab';
import { PerformanceTab } from './PerformanceTab';

type Tab = 'calendar' | 'performance' | 'ads' | 'resources';

// Corporate calendar events (static — synced by HQ)
const CALENDAR_EVENTS = [
  { date: 'Dec 1', title: 'Holiday Campaign Launch', type: 'campaign', detail: 'Promote gift memberships and holiday packs. Use provided creative assets.' },
  { date: 'Dec 15', title: 'Year-End Review Deadline', type: 'deadline', detail: 'Submit annual location performance summary to corporate.' },
  { date: 'Jan 1', title: 'New Year Promo Window', type: 'campaign', detail: '"New Year, New Player" campaign. Run Jan 1–15 across all channels.' },
  { date: 'Jan 15', title: 'Q1 Eval Blitz', type: 'event', detail: 'Push free evaluation bookings. Goal: 10 evals per location.' },
  { date: 'Feb 1', title: 'Valentine\'s Day Bundle', type: 'campaign', detail: 'Father/son + parent/child session packages. Promote Feb 1–14.' },
  { date: 'Mar 1', title: 'Spring Season Kickoff', type: 'campaign', detail: 'Travel ball season starts. Targeted ads for 10U–14U age groups.' },
  { date: 'Mar 31', title: 'Q1 Royalty Report Due', type: 'deadline', detail: 'Submit Q1 revenue and member counts to corporate portal.' },
];

const typeColor = (t: string) => t === 'campaign' ? 'gold' : t === 'deadline' ? 'danger' : 'info';

// Resources list
const RESOURCES = [
  { title: 'Brand Standards Guide', desc: 'Logo usage, colors, fonts, and tone of voice.', url: '#' },
  { title: 'Social Media Templates', desc: 'Canva templates for Instagram, Facebook, and TikTok.', url: '#' },
  { title: 'Email Campaign Playbook', desc: 'Monthly cadence, subject lines, and copy guidelines.', url: '#' },
  { title: 'Google Ads Starter Pack', desc: 'Keyword lists, ad copy, and audience targeting specs.', url: '#' },
  { title: 'Photography Guidelines', desc: 'Facility and player photography standards.', url: '#' },
  { title: 'Press Release Template', desc: 'For grand openings, milestones, and local press.', url: '#' },
];

function CalendarTab() {
  return (
    <div>
      <SectionHeader title="Corporate Marketing Calendar" subtitle="Events, campaigns, and deadlines from Infinite Hitting HQ" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CALENDAR_EVENTS.map((evt, i) => (
          <OCard key={i} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 48 }}>
                <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {evt.date.split(' ')[0]}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.gold, lineHeight: 1.2 }}>
                  {evt.date.split(' ')[1]}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: brand.text }}>{evt.title}</div>
                  <Chip color={typeColor(evt.type)} size="sm">{evt.type}</Chip>
                </div>
                <div style={{ fontSize: 12, color: brand.textMuted, lineHeight: 1.5 }}>{evt.detail}</div>
              </div>
            </div>
          </OCard>
        ))}
      </div>
    </div>
  );
}

function ResourcesTab() {
  return (
    <div>
      <SectionHeader title="Marketing Resources" subtitle="Brand assets, templates, and playbooks from corporate" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {RESOURCES.map((r, i) => (
          <OCard key={i} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${brand.goldDeep}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={16} color={brand.goldDeep} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: brand.text }}>{r.title}</div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: brand.goldDeep, flexShrink: 0 }}>
                    <ExternalLink size={14} />
                  </a>
                </div>
                <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 3, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          </OCard>
        ))}
      </div>
    </div>
  );
}

export function MarketingContent({ preview = false }: { preview?: boolean }) {
  const [tab, setTab] = useState<Tab>(preview ? 'performance' : 'calendar');

  const tabs: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'calendar', label: 'Calendar', icon: <Calendar size={13} /> },
    { key: 'performance', label: 'Performance', icon: <LineChart size={13} /> },
    { key: 'ads', label: 'Ads Manager', icon: <Megaphone size={13} /> },
    { key: 'resources', label: 'Resources', icon: <BookOpen size={13} /> },
  ];

  return (
    <div>
      <PageHeader title="Marketing" subtitle="Corporate campaigns, ad performance, and brand resources" />

      <div style={{ padding: '0 24px 24px' }}>
        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: 20,
                border: `1px solid ${tab === t.key ? brand.goldDeep : brand.border}`,
                background: tab === t.key ? brand.goldDeep : brand.surface,
                color: tab === t.key ? brand.dark : brand.textMuted,
                fontFamily: fonts.display, fontWeight: 700, fontSize: 12,
                letterSpacing: 0.5, textTransform: 'uppercase' as const, cursor: 'pointer',
              }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {tab === 'calendar' && <CalendarTab />}
        {tab === 'performance' && <PerformanceTab preview={preview} />}
        {tab === 'ads' && <AdsTab preview={preview} />}
        {tab === 'resources' && <ResourcesTab />}
      </div>
    </div>
  );
}
