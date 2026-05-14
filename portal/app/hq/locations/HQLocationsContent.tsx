'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { MapPin, Plus, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import type { HQLocation } from '@/lib/supabase/hqQueries';
import { HQNewLocationModal } from './HQNewLocationModal';

interface Props {
  locations: HQLocation[];
}

function stripeStatusChip(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    connected:     { label: 'Connected',    color: brand.success,  bg: brand.successBg,  icon: CheckCircle2 },
    pending:       { label: 'Pending',      color: brand.warning,  bg: brand.warningBg,  icon: Clock },
    restricted:    { label: 'Restricted',   color: brand.danger,   bg: brand.dangerBg,   icon: AlertCircle },
    not_connected: { label: 'Not Connected',color: brand.textMuted, bg: brand.border,    icon: XCircle },
  };
  const s = map[status] ?? map.not_connected;
  const Icon = s.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
      borderRadius: 20, background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

export function HQLocationsContent({ locations }: Props) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: 0, letterSpacing: 0.5 }}>
            Locations
          </h1>
          <p style={{ color: brand.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            {locations.length} location{locations.length !== 1 ? 's' : ''} across the network
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: brand.gold, color: brand.darker,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: fonts.display, letterSpacing: 0.5,
          }}
        >
          <Plus size={15} />
          New Location
        </button>
      </div>

      {/* Table */}
      <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
              {['Location', 'Tenant', 'Region', 'Stripe', 'Members', 'Royalty Rate', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '11px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: brand.textMuted,
                  letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>
                  No locations yet. Click &ldquo;New Location&rdquo; to add one.
                </td>
              </tr>
            ) : (
              locations.map((loc, i) => (
                <tr key={loc.id} style={{
                  borderBottom: i < locations.length - 1 ? `1px solid ${brand.border}` : 'none',
                  background: 'transparent',
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 7,
                        background: brand.goldDeep + '22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <MapPin size={14} color={brand.goldDeep} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: brand.text }}>{loc.name}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted }}>{loc.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: brand.text }}>
                    <div style={{ fontWeight: 500 }}>{loc.tenantName}</div>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{loc.tenantSlug}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: brand.textMuted }}>
                    {[loc.city, loc.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {stripeStatusChip(loc.stripeStatus)}
                  </td>
                  <td style={{ padding: '12px 16px', color: brand.text, fontWeight: 600 }}>
                    {loc.memberCount.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 16px', color: brand.text }}>
                    {(loc.royaltyRate * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      background: loc.isActive ? brand.successBg : brand.dangerBg,
                      color: loc.isActive ? brand.success : brand.danger,
                      fontSize: 11, fontWeight: 600,
                    }}>
                      {loc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && <HQNewLocationModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
