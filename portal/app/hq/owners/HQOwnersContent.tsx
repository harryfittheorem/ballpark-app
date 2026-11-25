'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { User, MapPin, Phone, Mail, Calendar, CheckSquare, AlertCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';

interface CallNote {
  date: string;
  dept: 'Marketing' | 'Sales' | 'Leadership';
  author: string;
  note: string;
}

interface Action {
  task: string;
  owner: string;
  due: string;
  status: 'Open' | 'Done' | 'Overdue';
}

interface MonthPerf {
  month: string;
  mrr: number;
  newMembers: number;
  leads: number;
  closingRate: number;
  churn: number;
}

interface FranchiseOwner {
  id: number;
  name: string;
  email: string;
  phone: string;
  locations: string[];
  region: string;
  signedDate: string;
  openedDate: string;
  status: 'Active' | 'At Risk' | 'New';
  mrr: number;
  members: number;
  callNotes: CallNote[];
  actions: Action[];
  monthlyPerf: MonthPerf[];
}

const OWNERS: FranchiseOwner[] = [
  {
    id: 1, name: 'James Calloway', email: 'james@ihchicago.com', phone: '(312) 555-0101',
    locations: ['Chicago — Lincoln Park'], region: 'Midwest',
    signedDate: 'Mar 2024', openedDate: 'Jul 2024', status: 'Active', mrr: 97400, members: 162,
    callNotes: [
      { date: 'Nov 18, 2026', dept: 'Leadership', author: 'Harry Singh', note: 'Q4 review — MRR up 12% YoY. Discussed expansion to Naperville location, targeting Q2 2027.' },
      { date: 'Oct 22, 2026', dept: 'Marketing', author: 'Priya Mehta', note: 'Google Ads campaign launched. CPL down from $48 to $31. Increasing budget for November.' },
      { date: 'Sep 15, 2026', dept: 'Sales', author: 'Mike Torres', note: 'Closing rate jumped to 74% after implementing new eval script. Sharing template with other owners.' },
    ],
    actions: [
      { task: 'Submit Q4 royalty reconciliation', owner: 'James', due: 'Dec 1, 2026', status: 'Open' },
      { task: 'Complete Trainual refresher — Sales Module', owner: 'James', due: 'Nov 30, 2026', status: 'Open' },
      { task: 'Respond to GM hire checklist', owner: 'Harry', due: 'Nov 20, 2026', status: 'Done' },
    ],
    monthlyPerf: [
      { month: 'Nov 2026', mrr: 97400, newMembers: 14, leads: 29, closingRate: 74, churn: 3 },
      { month: 'Oct 2026', mrr: 94200, newMembers: 12, leads: 26, closingRate: 71, churn: 4 },
      { month: 'Sep 2026', mrr: 91600, newMembers: 10, leads: 24, closingRate: 68, churn: 5 },
      { month: 'Aug 2026', mrr: 88900, newMembers: 9,  leads: 22, closingRate: 65, churn: 6 },
      { month: 'Jul 2026', mrr: 85100, newMembers: 8,  leads: 20, closingRate: 62, churn: 5 },
      { month: 'Jun 2026', mrr: 82400, newMembers: 7,  leads: 18, closingRate: 60, churn: 4 },
    ],
  },
  {
    id: 2, name: 'Sandra Mejia', email: 'sandra@ihfrisco.com', phone: '(972) 555-0202',
    locations: ['Dallas — Frisco'], region: 'South',
    signedDate: 'May 2024', openedDate: 'Sep 2024', status: 'Active', mrr: 88200, members: 148,
    callNotes: [
      { date: 'Nov 10, 2026', dept: 'Leadership', author: 'Harry Singh', note: 'Strong retention numbers. Sandra is a good candidate for peer-mentor program launch.' },
      { date: 'Oct 5, 2026', dept: 'Sales', author: 'Mike Torres', note: 'Closing rate at 68%. Working on lead nurture sequence to improve eval conversion.' },
    ],
    actions: [
      { task: 'Review and sign Q3 performance audit', owner: 'Sandra', due: 'Dec 5, 2026', status: 'Open' },
      { task: 'Set up auto-pay reminder campaign', owner: 'Sandra', due: 'Nov 15, 2026', status: 'Done' },
    ],
    monthlyPerf: [
      { month: 'Nov 2026', mrr: 88200, newMembers: 11, leads: 24, closingRate: 68, churn: 4 },
      { month: 'Oct 2026', mrr: 85600, newMembers: 9,  leads: 22, closingRate: 65, churn: 5 },
      { month: 'Sep 2026', mrr: 82100, newMembers: 8,  leads: 20, closingRate: 63, churn: 6 },
      { month: 'Aug 2026', mrr: 79400, newMembers: 7,  leads: 18, closingRate: 61, churn: 5 },
      { month: 'Jul 2026', mrr: 77200, newMembers: 6,  leads: 16, closingRate: 59, churn: 4 },
      { month: 'Jun 2026', mrr: 74800, newMembers: 5,  leads: 14, closingRate: 57, churn: 5 },
    ],
  },
  {
    id: 3, name: 'Derek Thompson', email: 'derek@ihalpharetta.com', phone: '(770) 555-0303',
    locations: ['Atlanta — Alpharetta'], region: 'Southeast',
    signedDate: 'Jul 2024', openedDate: 'Nov 2024', status: 'At Risk', mrr: 76500, members: 134,
    callNotes: [
      { date: 'Nov 20, 2026', dept: 'Leadership', author: 'Harry Singh', note: 'Two consecutive months of MRR decline. Scheduled performance review for Dec 2. Derek agreed to implement eval script from James.' },
      { date: 'Nov 1, 2026', dept: 'Sales', author: 'Mike Torres', note: 'Closing rate dropped from 68% to 65%. Lead volume down. Local competitor (BaseballU) opened 2 miles away.' },
      { date: 'Oct 12, 2026', dept: 'Marketing', author: 'Priya Mehta', note: 'Paused Google Ads due to budget concerns. Recommended reallocating to Facebook lead gen.' },
    ],
    actions: [
      { task: 'Complete performance review call', owner: 'Harry', due: 'Dec 2, 2026', status: 'Open' },
      { task: 'Implement new eval closing script', owner: 'Derek', due: 'Nov 28, 2026', status: 'Overdue' },
      { task: 'Reactivate Google Ads campaign', owner: 'Derek', due: 'Dec 10, 2026', status: 'Open' },
    ],
    monthlyPerf: [
      { month: 'Nov 2026', mrr: 76500, newMembers: 9,  leads: 20, closingRate: 65, churn: 7 },
      { month: 'Oct 2026', mrr: 78200, newMembers: 8,  leads: 19, closingRate: 65, churn: 8 },
      { month: 'Sep 2026', mrr: 80100, newMembers: 10, leads: 22, closingRate: 68, churn: 5 },
      { month: 'Aug 2026', mrr: 79400, newMembers: 9,  leads: 21, closingRate: 67, churn: 6 },
      { month: 'Jul 2026', mrr: 77600, newMembers: 8,  leads: 19, closingRate: 66, churn: 5 },
      { month: 'Jun 2026', mrr: 75200, newMembers: 7,  leads: 17, closingRate: 64, churn: 6 },
    ],
  },
];

const NETWORK_AVG: MonthPerf = { month: 'Nov 2026', mrr: 60800, newMembers: 7, leads: 18, closingRate: 57, churn: 5 };

const deptColor = (dept: CallNote['dept']) => {
  if (dept === 'Leadership') return { bg: `${brand.gold}18`, color: brand.goldDeep };
  if (dept === 'Marketing')  return { bg: `${brand.info}18`, color: brand.info };
  return { bg: `${brand.success}18`, color: brand.success };
};

const statusBadge = (status: 'Open' | 'Done' | 'Overdue') => {
  if (status === 'Done')    return { bg: '#dcfce7', color: '#166534', label: '✅ Done' };
  if (status === 'Overdue') return { bg: '#fee2e2', color: '#991b1b', label: '⚠️ Overdue' };
  return { bg: '#f1f5f9', color: '#475569', label: 'Open' };
};

export function HQOwnersContent() {
  const [selected, setSelected] = useState<FranchiseOwner>(OWNERS[0]);
  const [expandNotes, setExpandNotes] = useState(true);
  const [expandActions, setExpandActions] = useState(true);
  const [expandPerf, setExpandPerf] = useState(true);
  const [noteFilter, setNoteFilter] = useState<'All' | 'Marketing' | 'Sales' | 'Leadership'>('All');

  const filteredNotes = noteFilter === 'All' ? selected.callNotes : selected.callNotes.filter(n => n.dept === noteFilter);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 'calc(100vh - 56px)' }}>
      {/* Left sidebar — owner list */}
      <div style={{ width: 260, flexShrink: 0, borderRight: `1px solid ${brand.border}`, background: brand.surfaceAlt, overflowY: 'auto', padding: '16px 0' }}>
        <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display }}>
          Franchise Owners ({OWNERS.length})
        </div>
        {OWNERS.map(o => (
          <button
            key={o.id}
            onClick={() => setSelected(o)}
            style={{
              width: '100%', textAlign: 'left', padding: '12px 16px', cursor: 'pointer',
              background: selected.id === o.id ? `${brand.gold}14` : 'transparent',
              borderLeft: selected.id === o.id ? `3px solid ${brand.goldDeep}` : '3px solid transparent',
              border: 'none', borderRight: 'none', borderTop: 'none', borderBottom: `1px solid ${brand.border}`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13, color: brand.text }}>{o.name}</div>
            <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{o.locations[0]}</div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                background: o.status === 'At Risk' ? '#fee2e2' : o.status === 'New' ? '#eff6ff' : '#dcfce7',
                color: o.status === 'At Risk' ? '#991b1b' : o.status === 'New' ? '#1e40af' : '#166534',
              }}>{o.status}</span>
              <span style={{ fontSize: 11, color: brand.textMuted }}>${(o.mrr / 1000).toFixed(0)}k MRR</span>
            </div>
          </button>
        ))}
      </div>

      {/* Right detail panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        {/* Owner header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: fonts.display, fontSize: 22, fontWeight: 800, color: brand.text, margin: '0 0 4px' }}>
              {selected.name}
            </h1>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: brand.textMuted, marginTop: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {selected.locations.join(', ')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {selected.email}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {selected.phone}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> Signed {selected.signedDate} · Opened {selected.openedDate}</span>
            </div>
          </div>
          <span style={{
            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 12,
            background: selected.status === 'At Risk' ? '#fee2e2' : '#dcfce7',
            color: selected.status === 'At Risk' ? '#991b1b' : '#166534',
          }}>{selected.status}</span>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'MRR', value: `$${selected.mrr.toLocaleString()}` },
            { label: 'Members', value: String(selected.members) },
            { label: 'Region', value: selected.region },
            { label: 'Locations', value: String(selected.locations.length) },
          ].map(k => (
            <div key={k.label} style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.text }}>{k.value}</div>
              <div style={{ fontSize: 11, color: brand.textMuted }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Call Notes */}
        <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setExpandNotes(e => !e)}
            style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 14, color: brand.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={14} color={brand.goldDeep} /> Call Notes
              <span style={{ fontSize: 11, fontWeight: 400, color: brand.textMuted }}>({selected.callNotes.length})</span>
            </div>
            {expandNotes ? <ChevronUp size={16} color={brand.textMuted} /> : <ChevronDown size={16} color={brand.textMuted} />}
          </button>
          {expandNotes && (
            <div style={{ borderTop: `1px solid ${brand.border}` }}>
              {/* filter tabs */}
              <div style={{ padding: '10px 20px', display: 'flex', gap: 6, borderBottom: `1px solid ${brand.border}` }}>
                {(['All', 'Leadership', 'Sales', 'Marketing'] as const).map(d => (
                  <button key={d} onClick={() => setNoteFilter(d)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: noteFilter === d ? brand.goldDeep : 'transparent',
                    color: noteFilter === d ? brand.darker : brand.textMuted,
                    border: `1px solid ${noteFilter === d ? brand.goldDeep : brand.border}`,
                  }}>{d}</button>
                ))}
              </div>
              {filteredNotes.map((n, i) => {
                const c = deptColor(n.dept);
                return (
                  <div key={i} style={{ padding: '14px 20px', borderBottom: i < filteredNotes.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color }}>{n.dept}</span>
                      <span style={{ fontSize: 12, color: brand.textMuted }}>{n.date}</span>
                      <span style={{ fontSize: 11, color: brand.textMuted }}>by {n.author}</span>
                    </div>
                    <p style={{ fontSize: 13, color: brand.text, lineHeight: 1.6, margin: 0 }}>{n.note}</p>
                  </div>
                );
              })}
              <div style={{ padding: '10px 20px', borderTop: `1px solid ${brand.border}` }}>
                <button style={{ fontSize: 12, color: brand.goldDeep, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={13} /> Add note
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Tracking */}
        <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setExpandActions(e => !e)}
            style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 14, color: brand.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={14} color={brand.goldDeep} /> Action Tracking
              {selected.actions.some(a => a.status === 'Overdue') && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>Overdue</span>}
            </div>
            {expandActions ? <ChevronUp size={16} color={brand.textMuted} /> : <ChevronDown size={16} color={brand.textMuted} />}
          </button>
          {expandActions && (
            <div style={{ borderTop: `1px solid ${brand.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: brand.surfaceAlt }}>
                    {['Task', 'Owner', 'Due', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: fonts.display }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.actions.map((a, i) => {
                    const sb = statusBadge(a.status);
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${brand.border}` }}>
                        <td style={{ padding: '10px 16px', color: brand.text }}>{a.task}</td>
                        <td style={{ padding: '10px 16px', color: brand.textMuted }}>{a.owner}</td>
                        <td style={{ padding: '10px 16px', color: brand.textMuted, fontSize: 12 }}>{a.due}</td>
                        <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sb.bg, color: sb.color }}>{sb.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${brand.border}` }}>
                <button style={{ fontSize: 12, color: brand.goldDeep, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={13} /> Add action
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Performance History */}
        <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setExpandPerf(e => !e)}
            style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 14, color: brand.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color={brand.goldDeep} /> Monthly Performance vs Network
            </div>
            {expandPerf ? <ChevronUp size={16} color={brand.textMuted} /> : <ChevronDown size={16} color={brand.textMuted} />}
          </button>
          {expandPerf && (
            <div style={{ borderTop: `1px solid ${brand.border}`, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: brand.surfaceAlt }}>
                    {['Month', 'MRR', 'vs Avg', 'New Members', 'Leads', 'Closing Rate', 'Churn'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Network avg row */}
                  <tr style={{ background: `${brand.gold}08`, borderBottom: `1px solid ${brand.border}` }}>
                    <td style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: brand.textMuted }}>Network Avg</td>
                    <td style={{ padding: '8px 14px', fontFamily: fonts.mono, color: brand.textMuted }}>${NETWORK_AVG.mrr.toLocaleString()}</td>
                    <td />
                    <td style={{ padding: '8px 14px', color: brand.textMuted }}>{NETWORK_AVG.newMembers}</td>
                    <td style={{ padding: '8px 14px', color: brand.textMuted }}>{NETWORK_AVG.leads}</td>
                    <td style={{ padding: '8px 14px', color: brand.textMuted }}>{NETWORK_AVG.closingRate}%</td>
                    <td style={{ padding: '8px 14px', color: brand.textMuted }}>{NETWORK_AVG.churn}%</td>
                  </tr>
                  {selected.monthlyPerf.map((p, i) => {
                    const diff = p.mrr - NETWORK_AVG.mrr;
                    const pct = Math.round((diff / NETWORK_AVG.mrr) * 100);
                    return (
                      <tr key={i} style={{ borderBottom: i < selected.monthlyPerf.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600, color: brand.text }}>{p.month}</td>
                        <td style={{ padding: '9px 14px', fontFamily: fonts.mono, fontWeight: 700, color: brand.gold }}>${p.mrr.toLocaleString()}</td>
                        <td style={{ padding: '9px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 0 ? brand.success : brand.danger }}>
                            {pct >= 0 ? '+' : ''}{pct}%
                          </span>
                        </td>
                        <td style={{ padding: '9px 14px', color: brand.text }}>{p.newMembers}</td>
                        <td style={{ padding: '9px 14px', color: brand.text }}>{p.leads}</td>
                        <td style={{ padding: '9px 14px', color: brand.text }}>{p.closingRate}%</td>
                        <td style={{ padding: '9px 14px', color: brand.text }}>{p.churn}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
