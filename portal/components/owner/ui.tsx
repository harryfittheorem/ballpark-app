'use client';

import { useState } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

// ── KPICard ────────────────────────────────────────────────────────────────

type KPIColor = 'default' | 'gold' | 'danger' | 'success' | 'warning';

interface KPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  icon?: React.ElementType;
  color?: KPIColor;
}

const kpiColors: Record<KPIColor, { bg: string; border: string; iconBg: string; iconColor: string }> = {
  default: { bg: brand.surface, border: brand.border, iconBg: `${brand.goldDeep}22`, iconColor: brand.goldDeep },
  gold: { bg: `${brand.gold}15`, border: brand.goldDeep, iconBg: brand.gold, iconColor: brand.dark },
  danger: { bg: brand.dangerBg, border: brand.danger, iconBg: `${brand.danger}22`, iconColor: brand.danger },
  success: { bg: brand.successBg, border: brand.success, iconBg: `${brand.success}22`, iconColor: brand.success },
  warning: { bg: brand.warningBg, border: brand.warning, iconBg: `${brand.warning}22`, iconColor: brand.warning },
};

export function KPICard({ label, value, unit, delta, deltaLabel, icon: Icon, color = 'default' }: KPICardProps) {
  const c = kpiColors[color];
  const isPositive = (delta ?? 0) >= 0;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display }}>{label}</div>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: c.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={16} color={c.iconColor} strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: -0.5, lineHeight: 1 }}>{value}</div>
        {unit && <div style={{ fontSize: 13, color: brand.textMuted, fontWeight: 600 }}>{unit}</div>}
      </div>
      {delta !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: isPositive ? brand.success : brand.danger }}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {isPositive ? '+' : ''}{delta}%
          <span style={{ color: brand.textMuted, fontWeight: 500, marginLeft: 4 }}>{deltaLabel || 'vs last month'}</span>
        </div>
      )}
    </div>
  );
}

// ── Chip ───────────────────────────────────────────────────────────────────

type ChipColor = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
type ChipSize = 'md' | 'sm';

const chipColors: Record<ChipColor, { bg: string; text: string; border: string }> = {
  default: { bg: brand.surfaceAlt, text: brand.textMuted, border: brand.border },
  success: { bg: brand.successBg, text: brand.success, border: 'transparent' },
  warning: { bg: brand.warningBg, text: brand.warning, border: 'transparent' },
  danger: { bg: brand.dangerBg, text: brand.danger, border: 'transparent' },
  info: { bg: brand.infoBg, text: brand.info, border: 'transparent' },
  gold: { bg: `${brand.gold}44`, text: brand.goldDeep, border: 'transparent' },
};

export function Chip({ children, color = 'default', size = 'md' }: { children: ReactNode; color?: ChipColor; size?: ChipSize }) {
  const c = chipColors[color];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '2px 7px' : '3px 10px',
      background: c.bg, color: c.text,
      borderRadius: 20, fontSize: size === 'sm' ? 10 : 11, fontWeight: 700,
      border: `1px solid ${c.border}`, letterSpacing: 0.3,
      textTransform: 'uppercase', fontFamily: fonts.display,
    }}>{children}</span>
  );
}

// ── OButton ────────────────────────────────────────────────────────────────

type OBtnVariant = 'primary' | 'gold' | 'secondary' | 'ghost';
type OBtnSize = 'sm' | 'md';

const btnVariants: Record<OBtnVariant, { bg: string; color: string; border: string }> = {
  primary: { bg: brand.dark, color: brand.gold, border: brand.dark },
  gold: { bg: brand.gold, color: brand.dark, border: brand.gold },
  secondary: { bg: brand.white, color: brand.text, border: brand.borderStrong },
  ghost: { bg: 'transparent', color: brand.textMuted, border: 'transparent' },
};

const btnSizes: Record<OBtnSize, { padding: string; fontSize: number }> = {
  sm: { padding: '6px 12px', fontSize: 11 },
  md: { padding: '9px 16px', fontSize: 13 },
};

export function OButton({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  onClick,
  style: extraStyle = {},
}: {
  children?: ReactNode;
  variant?: OBtnVariant;
  size?: OBtnSize;
  icon?: React.ElementType;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const v = btnVariants[variant];
  const s = btnSizes[size];
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: s.padding, fontSize: s.fontSize,
      background: v.bg, color: v.color,
      border: `1px solid ${v.border}`, borderRadius: 8,
      fontWeight: 700, cursor: 'pointer',
      fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
      ...extraStyle,
    }}>
      {Icon && <Icon size={s.fontSize + 2} strokeWidth={2.5} />}
      {children}
    </button>
  );
}

// ── PageHeader ─────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, breadcrumb }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: string;
}) {
  return (
    <div style={{ padding: '24px 32px 20px', borderBottom: `1px solid ${brand.border}`, background: brand.surface }}>
      {breadcrumb && (
        <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>{breadcrumb}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -0.5, color: brand.text, margin: 0 }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 13, color: brand.textMuted, marginTop: 4 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{actions}</div>}
      </div>
    </div>
  );
}

// ── SectionHeader ──────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: fonts.display, letterSpacing: 0.5, color: brand.text, textTransform: 'uppercase' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// ── OCard ──────────────────────────────────────────────────────────────────

export function OCard({ children, padding = 20, style = {} }: { children: ReactNode; padding?: number; style?: CSSProperties }) {
  return (
    <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, padding, ...style }}>
      {children}
    </div>
  );
}

// ── OTable ─────────────────────────────────────────────────────────────────

export interface TableColumn<T> {
  label: string;
  key: keyof T | string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
  sortable?: boolean;
}

export function OTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey as keyof T];
        const bv = b[sortKey as keyof T];
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  return (
    <div style={{ background: brand.surface, border: `1px solid ${brand.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
            {columns.map((col, i) => (
              <th
                key={i}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                style={{
                  padding: '12px 16px',
                  textAlign: col.align || 'left',
                  fontSize: 10, fontWeight: 800, color: sortKey === String(col.key) ? brand.goldDeep : brand.textMuted,
                  letterSpacing: 1, textTransform: 'uppercase', fontFamily: fonts.display, whiteSpace: 'nowrap',
                  cursor: col.sortable ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {col.sortable && (
                    <span style={{ opacity: sortKey === String(col.key) ? 1 : 0.3, display: 'inline-flex' }}>
                      {sortKey === String(col.key) && sortDir === 'desc'
                        ? <ChevronDown size={10} />
                        : <ChevronUp size={10} />
                      }
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${brand.border}` : 'none', cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = brand.surfaceAlt; }}
              onMouseLeave={(e) => { if (onRowClick) (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}
            >
              {columns.map((col, j) => (
                <td key={j} style={{ padding: '14px 16px', fontSize: 13, color: brand.text, textAlign: col.align || 'left', verticalAlign: 'middle' }}>
                  {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── MiniLineChart ──────────────────────────────────────────────────────────

export function MiniLineChart({ data, color = brand.goldDeep, height = 60, fill = true }: { data: number[]; color?: string; height?: number; fill?: boolean }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({ x: (i / (data.length - 1)) * 100, y: 100 - ((v - min) / range) * 100 }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const fillD = fill ? `${pathD} L100,100 L0,100 Z` : '';
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height }}>
      {fill && <path d={fillD} fill={`${color}22`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── BarChart ───────────────────────────────────────────────────────────────

export function BarChart({ data, color = brand.goldDeep, height = 160 }: {
  data: Array<{ label: string; value: number; highlight?: boolean }>;
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height, paddingBottom: 20, position: 'relative' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 }}>
          <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 700 }}>{d.value}</div>
          <div style={{ width: '100%', height: `${(d.value / max) * 100}%`, background: d.highlight ? brand.gold : color, borderRadius: '4px 4px 0 0', minHeight: 2 }} />
          <div style={{ fontSize: 9, color: brand.textMuted, fontWeight: 600, position: 'absolute', bottom: 0, transform: 'translateY(14px)' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── DonutChart ─────────────────────────────────────────────────────────────

export function DonutChart({ data, size = 140 }: { data: Array<{ value: number; color: string }>; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={brand.border} strokeWidth={10} />
      {data.map((d, i) => {
        const pct = d.value / total;
        const strokeDasharray = `${pct * circumference} ${circumference}`;
        const strokeDashoffset = -cumulative * circumference;
        cumulative += pct;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={d.color} strokeWidth={10}
            strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
      })}
    </svg>
  );
}
