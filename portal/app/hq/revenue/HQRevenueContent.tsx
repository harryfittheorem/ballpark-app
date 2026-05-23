'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { DollarSign, MapPin, TrendingUp, AlertCircle, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import type { HQNetworkKPIs, HQLocationRevenue, HQRecentTransaction } from '@/lib/supabase/hqQueries';
import { exportCsv } from '@/lib/exportCsv';

interface Props {
  kpis: HQNetworkKPIs;
  locationRevenue: HQLocationRevenue[];
  recentTransactions: HQRecentTransaction[];
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function fmtSmall(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function fmtDate(ts: string) {
  const d = new Date(ts);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getDate()}`;
}

function fmtDateFull(ts: string) {
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function stripeIcon(status: string) {
  if (status === 'connected') return <CheckCircle2 size={14} color={brand.success} />;
  if (status === 'pending') return <Clock size={14} color={brand.warning} />;
  if (status === 'not_connected') return <XCircle size={14} color={brand.textMuted} />;
  return <AlertCircle size={14} color={brand.danger} />;
}

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}
function KPICard({ label, value, sub, icon: Icon, accent = brand.goldDeep }: KPICardProps) {
  return (
    <div style={{
      background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`,
      padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display }}>
          {label}
        </span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={accent} />
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: brand.text, fontFamily: fonts.display, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: brand.textMuted }}>{sub}</div>}
    </div>
  );
}

export function HQRevenueContent({ kpis, locationRevenue, recentTransactions }: Props) {
  function handleExportCsv() {
    exportCsv(
      `ballpark-transactions-30d-${new Date().toISOString().slice(0, 10)}.csv`,
      recentTransactions.map(tx => ({
        date: fmtDateFull(tx.createdAt),
        tenant: tx.tenantName,
        location: tx.locationName ?? '',
        family: tx.familyName ?? '',
        amount: fmtSmall(tx.amount),
        type: tx.status,
      })),
      [
        { label: 'Date',      key: 'date' },
        { label: 'Tenant',    key: 'tenant' },
        { label: 'Location',  key: 'location' },
        { label: 'Family',    key: 'family' },
        { label: 'Amount',    key: 'amount' },
        { label: 'Type',      key: 'type' },
      ],
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: 0, letterSpacing: 0.5 }}>
            Network Revenue
          </h1>
          <p style={{ color: brand.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            Cross-location financial overview · 30-day window
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8,
            border: `1px solid ${brand.border}`,
            background: 'transparent', color: brand.text,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            fontFamily: fonts.display,
          }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <KPICard label="Network MRR" value={fmt(kpis.networkMRR)} sub={`${kpis.totalMembers.toLocaleString()} active members`} icon={TrendingUp} />
        <KPICard label="Royalties (30d)" value={fmtSmall(kpis.royaltiesCollected)} sub="2.5% of transactions" icon={DollarSign} accent={brand.success} />
        <KPICard label="Locations" value={String(kpis.totalLocations)} sub={`${kpis.locationsNotConnected} not connected`} icon={MapPin} accent={brand.info} />
        {kpis.locationsNotConnected > 0 && (
          <KPICard label="Stripe Action Items" value={String(kpis.locationsNotConnected)} sub="Locations need Stripe setup" icon={AlertCircle} accent={brand.danger} />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Per-location breakdown */}
        <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${brand.border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: brand.text, fontFamily: fonts.display }}>Per-Location MRR</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: brand.surfaceAlt }}>
                  {['Location', 'MRR', 'Members', 'Royalty', 'Stripe'].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700, color: brand.textMuted,
                      letterSpacing: 0.8, textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {locationRevenue.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
                      No data yet
                    </td>
                  </tr>
                ) : (
                  locationRevenue.map((loc, i) => (
                    <tr key={loc.locationId} style={{ borderTop: i > 0 ? `1px solid ${brand.border}` : 'none' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: brand.text, fontSize: 12 }}>{loc.locationName}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted }}>{loc.tenantName}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: brand.text }}>{fmt(loc.mrr)}</td>
                      <td style={{ padding: '10px 14px', color: brand.textMuted }}>{loc.memberCount}</td>
                      <td style={{ padding: '10px 14px', color: brand.success, fontWeight: 600 }}>{fmtSmall(loc.royalty)}</td>
                      <td style={{ padding: '10px 14px' }}>{stripeIcon(loc.stripeStatus)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent large transactions */}
        <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden' }}>
          <div style={{
            padding: '16px 20px', borderBottom: `1px solid ${brand.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: brand.text, fontFamily: fonts.display }}>Recent Transactions</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: brand.surfaceAlt }}>
                  {['Franchise', 'Amount', 'Date'].map(h => (
                    <th key={h} style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: 10, fontWeight: 700, color: brand.textMuted,
                      letterSpacing: 0.8, textTransform: 'uppercase',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((tx, i) => (
                    <tr key={tx.id} style={{ borderTop: i > 0 ? `1px solid ${brand.border}` : 'none' }}>
                      <td style={{ padding: '10px 14px', color: brand.text, fontWeight: 500 }}>{tx.tenantName}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: brand.text }}>{fmtSmall(tx.amount)}</td>
                      <td style={{ padding: '10px 14px', color: brand.textMuted }}>{fmtDate(tx.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stripe Action Items */}
      {kpis.locationsNotConnected > 0 && (
        <div style={{
          marginTop: 20, padding: '16px 20px', borderRadius: 12,
          background: brand.warningBg, border: `1px solid ${brand.warning}30`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertCircle size={18} color={brand.warning} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: brand.warning, fontSize: 13 }}>
              {kpis.locationsNotConnected} location{kpis.locationsNotConnected > 1 ? 's' : ''} need Stripe Connect setup
            </div>
            <div style={{ fontSize: 12, color: brand.textMuted, marginTop: 2 }}>
              Payments cannot be processed at these locations until Stripe onboarding is complete. Go to Locations to review.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
