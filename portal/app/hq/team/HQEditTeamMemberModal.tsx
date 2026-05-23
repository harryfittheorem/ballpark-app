'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { X, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import type { HQTeamMember } from '@/lib/supabase/hqQueries';

interface Props {
  member: HQTeamMember;
  onClose: () => void;
}

/**
 * Returns the set of roles the member can be reassigned to via this modal.
 *
 * Rules:
 * - super_admin: role cannot be changed (no editable roles)
 * - coach: can be promoted to admin or owner (their coaches row is deactivated)
 * - admin/owner: lateral moves between admin and owner only
 *   (demoting to coach is handled by the Invite flow, not this modal)
 */
function editableRolesFor(currentRole: string): Array<'coach' | 'admin' | 'owner'> {
  if (currentRole === 'super_admin') return [];
  return ['admin', 'owner'];
}

export function HQEditTeamMemberModal({ member, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editableRoles = editableRolesFor(member.role);
  const canEditRole = editableRoles.length > 0;

  const [selectedRole, setSelectedRole] = useState<typeof editableRoles[number]>(
    editableRoles.includes(member.role as 'admin' | 'owner') ? member.role as 'admin' | 'owner' : editableRoles[0],
  );
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const isDeactivated = member.banned;

  async function callTeamApi(body: object) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/hq/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Request failed');
      setSuccess(true);
      router.refresh();
      setTimeout(onClose, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRole(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRole === member.role) { onClose(); return; }
    await callTeamApi({
      userId: member.userId,
      action: 'update_role',
      fromRole: member.role,
      role: selectedRole,
    });
  }

  async function handleToggleBan() {
    const action = isDeactivated ? 'unban' : 'ban';
    await callTeamApi({ userId: member.userId, action });
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 7,
    border: `1px solid ${brand.border}`, background: brand.surfaceAlt,
    fontSize: 13, color: brand.text, outline: 'none', boxSizing: 'border-box',
  };

  const DeactivateSection = () => (
    <>
      {showDeactivateConfirm && !isDeactivated && (
        <div style={{
          padding: '14px 16px', borderRadius: 8,
          background: brand.dangerBg, border: `1px solid ${brand.danger}40`,
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={13} color={brand.danger} />
            <span style={{ fontSize: 12, fontWeight: 700, color: brand.danger }}>
              Deactivate {member.name}?
            </span>
          </div>
          <p style={{ fontSize: 11, color: brand.textMuted, margin: '0 0 10px' }}>
            They won&apos;t be able to log in until reactivated.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleToggleBan}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: brand.danger, color: '#fff',
                fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading && <Loader2 size={11} />}
              Confirm Deactivate
            </button>
            <button
              type="button"
              onClick={() => setShowDeactivateConfirm(false)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: `1px solid ${brand.border}`, background: 'transparent',
                color: brand.textMuted, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showDeactivateConfirm && (
        <button
          type="button"
          onClick={() => isDeactivated ? handleToggleBan() : setShowDeactivateConfirm(true)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '7px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: `1px solid ${isDeactivated ? brand.success + '60' : brand.danger + '60'}`,
            background: 'transparent',
            color: isDeactivated ? brand.success : brand.danger,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && <Loader2 size={11} />}
          {isDeactivated ? 'Reactivate' : 'Deactivate'}
        </button>
      )}
    </>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 14, width: 460,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: `1px solid ${brand.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: fonts.display, color: brand.text }}>
            Edit Team Member
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} color={brand.textMuted} />
          </button>
        </div>

        {success ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <CheckCircle2 size={40} color={brand.success} style={{ marginBottom: 12 }} />
            <p style={{ color: brand.text, fontWeight: 600, margin: 0 }}>Updated successfully.</p>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            {/* Member info */}
            <div style={{
              padding: '12px 14px', borderRadius: 8, background: brand.surfaceAlt,
              marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 8, background: brand.goldDeep + '22',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: brand.goldDeep, fontFamily: fonts.display,
                flexShrink: 0,
              }}>
                {member.name.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600, color: brand.text, fontSize: 14 }}>{member.name}</span>
                  {isDeactivated && (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px', borderRadius: 20,
                      background: brand.dangerBg, color: brand.danger, fontSize: 10, fontWeight: 700,
                    }}>
                      DEACTIVATED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: brand.textMuted }}>{member.email}</div>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: brand.dangerBg, color: brand.danger, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            {/* Role editor — available for coach, admin, owner (not super_admin) */}
            {canEditRole && (
              <form onSubmit={handleSaveRole}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block', fontSize: 11, fontWeight: 700,
                    color: brand.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8,
                  }}>
                    Role
                  </label>
                  <select
                    style={{ ...inputStyle, appearance: 'none' }}
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as typeof selectedRole)}
                  >
                    {editableRoles.map(r => (
                      <option key={r} value={r}>
                        {r === 'admin' ? 'Admin' : 'Owner'}
                      </option>
                    ))}
                  </select>

                  {member.role === 'coach' && (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 6,
                      marginTop: 8, padding: '8px 10px', borderRadius: 6,
                      background: brand.infoBg, color: brand.info, fontSize: 11,
                    }}>
                      <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                      Promoting a coach removes their coach profile. To add a new coach, use the Invite button.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <DeactivateSection />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button" onClick={onClose}
                      style={{
                        padding: '9px 20px', borderRadius: 8, border: `1px solid ${brand.border}`,
                        background: 'transparent', color: brand.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit" disabled={loading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '9px 20px', borderRadius: 8, border: 'none',
                        background: brand.gold, color: brand.darker,
                        fontSize: 13, fontWeight: 700,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      {loading && <Loader2 size={13} />}
                      Save Role
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Super admin — deactivate only (role cannot be changed) */}
            {!canEditRole && (
              <div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <DeactivateSection />
                  <button
                    onClick={onClose}
                    style={{
                      padding: '9px 20px', borderRadius: 8, border: `1px solid ${brand.border}`,
                      background: 'transparent', color: brand.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
