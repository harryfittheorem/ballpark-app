'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { Users, Plus, Shield, UserCog, Crown, Pencil, Mail, X, Loader2 } from 'lucide-react';
import type { HQTeamMember, HQLocation, HQPendingInvite } from '@/lib/supabase/hqQueries';
import { HQInviteModal } from './HQInviteModal';
import { HQEditTeamMemberModal } from './HQEditTeamMemberModal';

interface Props {
  team: HQTeamMember[];
  locations: HQLocation[];
  pendingInvites: HQPendingInvite[];
}

const roleConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  super_admin: { label: 'HQ Admin',    color: brand.goldDeep, bg: brand.goldDeep + '18', icon: Crown },
  owner:       { label: 'Owner',       color: brand.info,     bg: brand.infoBg,          icon: Shield },
  admin:       { label: 'Admin',       color: brand.warning,  bg: brand.warningBg,       icon: Shield },
  coach:       { label: 'Coach',       color: brand.success,  bg: brand.successBg,       icon: UserCog },
};

type FilterRole = 'all' | 'coach' | 'owner' | 'admin' | 'super_admin';

function RoleChip({ role }: { role: string }) {
  const cfg = roleConfig[role] ?? roleConfig.coach;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px',
      borderRadius: 20, background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 600,
    }}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function formatLastSignIn(ts: string | null) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatJoined(ts: string) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatExpiry(ts: string) {
  const d = new Date(ts);
  const diffMs = d.getTime() - Date.now();
  const diffHrs = Math.ceil(diffMs / 3_600_000);
  if (diffHrs <= 0) return 'Expired';
  if (diffHrs < 24) return `${diffHrs}h`;
  return `${Math.ceil(diffHrs / 24)}d`;
}

function initials(name: string) {
  const parts = name.trim().split(' ');
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function HQTeamContent({ team, locations, pendingInvites }: Props) {
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editMember, setEditMember] = useState<HQTeamMember | null>(null);
  const [filter, setFilter] = useState<FilterRole>('all');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const filtered = filter === 'all' ? team : team.filter(m => m.role === filter);

  const tabs: { key: FilterRole; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'super_admin', label: 'HQ Admins' },
    { key: 'owner', label: 'Owners' },
    { key: 'admin', label: 'Admins' },
    { key: 'coach', label: 'Coaches' },
  ];

  async function handleRevoke(inviteId: string) {
    if (!confirm('Revoke this invitation? The link will stop working immediately.')) return;
    setRevokingId(inviteId);
    try {
      const res = await fetch(`/api/hq/invite/${inviteId}/revoke`, { method: 'POST' });
      if (!res.ok) {
        const b = await res.json() as { error?: string };
        throw new Error(b.error ?? 'Failed to revoke');
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke invite');
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 800, color: brand.text, margin: 0, letterSpacing: 0.5 }}>
            Team
          </h1>
          <p style={{ color: brand.textMuted, fontSize: 13, margin: '4px 0 0' }}>
            {team.length} member{team.length !== 1 ? 's' : ''} across all locations
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: brand.gold, color: brand.darker,
            fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: fonts.display,
          }}
        >
          <Plus size={15} />
          Invite
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === tab.key ? brand.goldDeep : brand.border}`,
              background: filter === tab.key ? brand.goldDeep + '18' : 'transparent',
              color: filter === tab.key ? brand.goldDeep : brand.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>
                {team.filter(m => m.role === tab.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Team table */}
      <div style={{ background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, overflow: 'hidden', marginBottom: 28 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
              {['Member', 'Role', 'Location', 'Franchise', 'Last Sign-In', 'Joined', ''].map(h => (
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>
                  No team members found. Click &ldquo;Invite&rdquo; to add someone.
                </td>
              </tr>
            ) : (
              filtered.map((m, i) => (
                <tr key={m.id} style={{
                  borderBottom: i < filtered.length - 1 ? `1px solid ${brand.border}` : 'none',
                  opacity: m.banned ? 0.6 : 1,
                }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8,
                        background: brand.goldDeep + '22',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: brand.goldDeep, fontFamily: fonts.display,
                      }}>
                        {initials(m.name).toUpperCase() || <Users size={14} color={brand.goldDeep} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, color: brand.text }}>{m.name}</span>
                          {m.banned && (
                            <span style={{
                              padding: '1px 7px', borderRadius: 20,
                              background: brand.dangerBg, color: brand.danger,
                              fontSize: 10, fontWeight: 700,
                            }}>
                              DEACTIVATED
                            </span>
                          )}
                        </div>
                        {m.email && <div style={{ fontSize: 11, color: brand.textMuted }}>{m.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}><RoleChip role={m.role} /></td>
                  <td style={{ padding: '12px 16px', color: brand.textMuted }}>{m.locationName ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: brand.text }}>{m.tenantName ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: brand.textMuted }}>{formatLastSignIn(m.lastSignIn)}</td>
                  <td style={{ padding: '12px 16px', color: brand.textMuted }}>{formatJoined(m.createdAt)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => setEditMember(m)}
                      title="Edit member"
                      style={{
                        background: 'none', border: `1px solid ${brand.border}`,
                        borderRadius: 6, padding: '5px 8px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Pencil size={12} color={brand.textMuted} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pending HQ Admin Invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h2 style={{
            fontFamily: fonts.display, fontSize: 16, fontWeight: 700,
            color: brand.text, margin: '0 0 12px', letterSpacing: 0.3,
          }}>
            Pending HQ Admin Invitations
            <span style={{
              marginLeft: 8, padding: '2px 9px', borderRadius: 12,
              background: brand.goldDeep + '18', color: brand.goldDeep,
              fontSize: 11, fontWeight: 700,
            }}>
              {pendingInvites.length}
            </span>
          </h2>
          <div style={{
            background: brand.surface, borderRadius: 12,
            border: `1px solid ${brand.border}`, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: brand.surfaceAlt, borderBottom: `1px solid ${brand.border}` }}>
                  {['Email', 'Invited By', 'Expires In', 'Sent', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: brand.textMuted,
                      letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: fonts.display,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv, i) => (
                  <tr key={inv.id} style={{
                    borderBottom: i < pendingInvites.length - 1 ? `1px solid ${brand.border}` : 'none',
                  }}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          background: brand.goldDeep + '18',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Mail size={12} color={brand.goldDeep} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: brand.text }}>{inv.email}</div>
                          <div style={{ fontSize: 11, color: brand.goldDeep }}>HQ Admin</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', color: brand.textMuted, fontSize: 12 }}>
                      {inv.invitedByName ?? '—'}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <span style={{
                        padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: brand.warningBg, color: brand.warning,
                      }}>
                        {formatExpiry(inv.expiresAt)}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px', color: brand.textMuted, fontSize: 12 }}>
                      {formatJoined(inv.createdAt)}
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        disabled={revokingId === inv.id}
                        title="Revoke invitation"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 10px', borderRadius: 6,
                          border: `1px solid ${brand.danger}40`,
                          background: brand.dangerBg,
                          color: brand.danger, fontSize: 11, fontWeight: 600,
                          cursor: revokingId === inv.id ? 'not-allowed' : 'pointer',
                          opacity: revokingId === inv.id ? 0.6 : 1,
                        }}
                      >
                        {revokingId === inv.id
                          ? <Loader2 size={10} />
                          : <X size={10} />
                        }
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInviteModal && <HQInviteModal onClose={() => setShowInviteModal(false)} locations={locations} />}
      {editMember && <HQEditTeamMemberModal member={editMember} onClose={() => setEditMember(null)} />}
    </div>
  );
}
