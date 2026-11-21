'use client';

import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, Chip } from '@/components/owner/ui';
import {
  Calendar, MessageCircle, Edit2, Activity, Clock,
  CheckCircle, XCircle, CreditCard, Star, Zap, TrendingUp,
  AlertCircle, PauseCircle, PlayCircle, Package, Phone, Mail, X,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MemberDetail, BookingFormOptions } from '@/lib/supabase/ownerQueries';
import type { DemoMemberDetail } from './demoMemberDetails';
import { NewBookingForm } from '../../schedule/NewBookingForm';

type Props = {
  member: MemberDetail | DemoMemberDetail;
  bookingOptions: BookingFormOptions;
  waiverStatus?: 'signed' | 'unsigned' | 'outdated' | null;
  waiverSignedAt?: string | null;
};

const modalInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${brand.border}`,
  borderRadius: 7, fontSize: 13, color: brand.text, background: brand.surface,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const modalLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    ) ?? []).filter(el => el.getClientRects().length > 0);
    (controls()[0] ?? dialog)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key !== 'Tab') return;
      const items = controls();
      if (!items.length) { e.preventDefault(); return; }
      if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === items.at(-1)) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(480px, calc(100vw - 32px))', maxHeight: '90dvh', overflowY: 'auto', background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>{title}</div>
          <button type="button" aria-label="Close dialog" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 12 }}>
            <X size={16} color={brand.textMuted} />
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function MessageModal({ member, onClose }: { member: MemberDetail | DemoMemberDetail; onClose: () => void }) {
  const [subject, setSubject] = useState(`A message from Infinite Hitting about ${member.name}`);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/members/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentEmail: member.parentEmail,
          parentName: member.parent,
          kidName: member.name,
          subject,
          message: messageText,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <ModalShell title="Message Sent" onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: brand.success, fontWeight: 700, fontSize: 13 }}>
          <CheckCircle size={16} />
          Message sent to {member.parentEmail}
        </div>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <OButton variant="secondary" onClick={onClose}>Close</OButton>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title={`Message ${member.parent}`} onClose={onClose}>
      <form onSubmit={handleSend}>
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle}>To</label>
          <div style={{ fontSize: 13, color: brand.text }}>{member.parentEmail || '—'}</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle}>Subject</label>
          <input required style={modalInputStyle} value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle}>Message</label>
          <textarea
            required
            rows={5}
            style={{ ...modalInputStyle, resize: 'vertical', fontFamily: fonts.body }}
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            placeholder={`Write a note to ${member.parent}...`}
          />
        </div>
        {error && (
          <div style={{ padding: '8px 10px', background: brand.dangerBg, borderRadius: 6, fontSize: 12, color: brand.danger, marginBottom: 12 }}>
            {error}
          </div>
        )}
        {!member.parentEmail && (
          <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 12 }}>
            No email on file for this family — sending will fail until one is added.
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <OButton type="button" variant="secondary" onClick={onClose} disabled={sending}>Cancel</OButton>
          <OButton type="submit" variant="gold" disabled={sending || !member.parentEmail}>{sending ? 'Sending…' : 'Send Message'}</OButton>
        </div>
      </form>
    </ModalShell>
  );
}

function EditMemberModal({ member, onClose, onSaved }: {
  member: MemberDetail | DemoMemberDetail;
  onClose: () => void;
  onSaved: (updates: { parentFirstName: string; parentLastName: string | null; parentEmail: string; parentPhone: string | null; program: string }) => void;
}) {
  const nameParts = member.parent.split(' ');
  const [firstName, setFirstName] = useState(member.parentFirstName ?? nameParts[0] ?? '');
  const [lastName, setLastName] = useState(member.parentLastName ?? nameParts.slice(1).join(' ') ?? '');
  const [email, setEmail] = useState(member.parentEmail ?? '');
  const [phone, setPhone] = useState(member.parentPhone ?? '');
  const [program, setProgram] = useState(member.program);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDemoMember = isDemo(member);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (isDemoMember) {
      onSaved({ parentFirstName: firstName, parentLastName: lastName || null, parentEmail: email, parentPhone: phone || null, program });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/owner/memberships/${member.id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parent_first_name: firstName,
          parent_last_name: lastName || null,
          parent_email: email,
          parent_phone: phone || null,
          plan_name: program,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        onSaved({ parentFirstName: firstName, parentLastName: lastName || null, parentEmail: email, parentPhone: phone || null, program });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Edit ${member.name}`} onClose={onClose}>
      <form onSubmit={handleSave}>
        {isDemoMember && (
          <div style={{ fontSize: 11, color: brand.textMuted, marginBottom: 12, fontStyle: 'italic' }}>
            This is a demo record — changes will not be saved.
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={modalLabelStyle}>Parent First Name</label>
            <input required style={modalInputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <label style={modalLabelStyle}>Parent Last Name</label>
            <input style={modalInputStyle} value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle}>Parent Email</label>
          <input required type="email" style={modalInputStyle} value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={modalLabelStyle}>Parent Phone</label>
          <input style={modalInputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="(312) 555-0100" />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={modalLabelStyle}>Program</label>
          <input required style={modalInputStyle} value={program} onChange={e => setProgram(e.target.value)} />
        </div>
        {error && (
          <div style={{ padding: '8px 10px', background: brand.dangerBg, borderRadius: 6, fontSize: 12, color: brand.danger, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <OButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</OButton>
          <OButton type="submit" variant="gold" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</OButton>
        </div>
      </form>
    </ModalShell>
  );
}

function BookSessionModal({ member, onClose }: {
  member: MemberDetail | DemoMemberDetail;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<{ date: Date; count: number } | null>(null);
  const kidId = (member as MemberDetail).kidId;

  if (saved) {
    return (
      <ModalShell title="Session Booked" onClose={onClose}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: brand.success, fontWeight: 700, fontSize: 13 }}>
          <CheckCircle size={16} />
          {saved.count} booking{saved.count === 1 ? '' : 's'} saved for {member.name}, starting {saved.date.toLocaleString()}.
        </div>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <OButton variant="secondary" onClick={onClose}>Close</OButton>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title={`Book Session for ${member.name}`} onClose={onClose}>
      {isDemo(member) || !kidId ? (
        <div style={{ fontSize: 13, color: brand.textMuted }}>
          This is a demo record and cannot have real bookings created for it.
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <OButton variant="secondary" onClick={onClose}>Close</OButton>
          </div>
        </div>
      ) : (
        <NewBookingForm initialAthleteId={kidId} showNotes onClose={onClose}
          onSaved={(date, count = 1) => { setSaved({ date, count }); router.refresh(); }} />
      )}
    </ModalShell>
  );
}

function isDemo(m: MemberDetail | DemoMemberDetail): m is DemoMemberDetail {
  return 'bestVeloMph' in m;
}

function monthsAgo(joinedDate: string): number {
  const parts = joinedDate.split(' ');
  if (parts.length < 2) return 0;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months.indexOf(parts[0]);
  const yr = parseInt(parts[1], 10);
  if (mon < 0 || isNaN(yr)) return 0;
  const now = new Date();
  return Math.max(1, (now.getFullYear() - yr) * 12 + (now.getMonth() - mon));
}

function formatNextBilling(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function KPIBlock({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: brand.surface,
      border: `1px solid ${brand.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        fontSize: 26,
        fontWeight: 800,
        fontFamily: fonts.display,
        color: highlight ? brand.success : brand.text,
        lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: brand.textMuted }}>{sub}</div>}
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 320;
  const h = 60;
  const pad = 8;
  const xs = points.map((_, i) => pad + (i / (points.length - 1)) * (w - pad * 2));
  const ys = points.map(v => h - pad - ((v - min) / range) * (h - pad * 2));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const fillD = `${d} L ${xs[xs.length-1].toFixed(1)} ${h} L ${xs[0].toFixed(1)} ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 60, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={brand.success} stopOpacity="0.18" />
          <stop offset="100%" stopColor={brand.success} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke={brand.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: large ? 15 : 13, fontWeight: large ? 700 : 500, color: brand.text }}>{value}</div>
    </div>
  );
}

function formatDateShort(isoDate: string | null): string {
  if (!isoDate) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '—';
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function PauseSection({ member }: { member: MemberDetail }) {
  const [resuming, setResuming] = useState(false);
  const [resumeDone, setResumeDone] = useState(false);
  const [resumeErr, setResumeErr] = useState<string | null>(null);

  const { pauseStart, pauseEnd } = member;

  const handleResumeEarly = useCallback(async () => {
    if (!confirm('Resume this membership immediately? Billing will restart on the next billing date.')) return;

    setResuming(true);
    setResumeErr(null);
    try {
      const res = await fetch('/api/memberships/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membership_id: member.id }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setResumeErr(typeof data.error === 'string' ? data.error : `Error ${res.status}`);
      } else {
        setResumeDone(true);
      }
    } catch (err) {
      setResumeErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setResuming(false);
    }
  }, [member.id]);

  if (resumeDone) {
    return (
      <div>
        <SectionHeader title="Membership Pause" />
        <OCard style={{ padding: 14, borderLeft: `4px solid ${brand.success}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlayCircle size={16} color={brand.success} />
            <span style={{ fontSize: 13, fontWeight: 700, color: brand.success }}>
              Membership resumed successfully
            </span>
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 6 }}>
            Billing will resume on the next billing date.
          </div>
        </OCard>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Membership Pause" />
      <OCard style={{ padding: 14, borderLeft: `4px solid ${brand.warning}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <PauseCircle size={16} color={brand.warning} />
          <Chip color="warning">Paused</Chip>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: brand.textMuted }}>Paused on</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: brand.text }}>
              {formatDateShort(pauseStart)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: brand.textMuted }}>Auto-resumes</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: brand.text }}>
              {formatDateShort(pauseEnd)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4, fontStyle: 'italic' }}>
            No billing charges until the resume date.
          </div>
        </div>

        {resumeErr && (
          <div style={{
            padding: '8px 10px', background: brand.dangerBg, borderRadius: 6,
            fontSize: 12, color: brand.danger, marginBottom: 8,
          }}>
            {resumeErr}
          </div>
        )}

        <button
          onClick={handleResumeEarly}
          disabled={resuming}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 6,
            border: `1px solid ${brand.gold}`, background: brand.gold,
            color: brand.dark, fontSize: 12, fontWeight: 700,
            cursor: resuming ? 'not-allowed' : 'pointer',
            opacity: resuming ? 0.6 : 1, letterSpacing: 0.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <PlayCircle size={14} />
          {resuming ? 'Resuming…' : 'Resume Early'}
        </button>
      </OCard>
    </div>
  );
}

function SessionsOverrideSection({ member }: { member: MemberDetail }) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentRemaining, setCurrentRemaining] = useState<number | null>(member.sessionsRemaining);

  const sessionsTotal = member.sessionsTotal ?? 0;

  const handleEdit = useCallback(() => {
    setInputValue(String(currentRemaining ?? 0));
    setSaveError(null);
    setEditing(true);
  }, [currentRemaining]);

  const handleSave = useCallback(async () => {
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed < 0) {
      setSaveError('Enter a valid non-negative number.');
      return;
    }
    if (parsed > sessionsTotal) {
      setSaveError(`Cannot exceed total (${sessionsTotal}).`);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/memberships/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membership_id: member.id, sessions_remaining: parsed }),
      });
      const data = await res.json() as { ok?: boolean; sessions_remaining?: number; error?: string };
      if (!res.ok || !data.ok) {
        setSaveError(data.error ?? `Error ${res.status}`);
      } else {
        setCurrentRemaining(data.sessions_remaining ?? parsed);
        setEditing(false);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [inputValue, member.id, sessionsTotal]);

  // All hooks must be called before any conditional return
  if (member.planType !== 'otc' || member.sessionsTotal === null) return null;

  return (
    <div>
      <SectionHeader title="Session Pack" />
      <OCard style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Package size={14} color={brand.gold} />
          <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            {member.program}
          </span>
        </div>

        {/* Credit bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 24, fontWeight: 800, fontFamily: fonts.display, color: (currentRemaining ?? 0) === 0 ? brand.danger : brand.text }}>
              {currentRemaining ?? 0}
            </span>
            <span style={{ fontSize: 11, color: brand.textMuted }}>of {sessionsTotal} remaining</span>
          </div>
          <div style={{ height: 6, background: brand.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${sessionsTotal > 0 ? Math.round(((currentRemaining ?? 0) / sessionsTotal) * 100) : 0}%`,
              background: (currentRemaining ?? 0) === 0 ? brand.danger : brand.success,
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Editing UI */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={0}
                max={sessionsTotal}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${brand.border}`,
                  background: brand.surfaceAlt,
                  color: brand.text,
                  fontSize: 14,
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
              <OButton
                variant="gold"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                style={{ flexShrink: 0 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </OButton>
              <OButton
                variant="secondary"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ flexShrink: 0 }}
              >
                Cancel
              </OButton>
            </div>
            {saveError && (
              <div style={{ fontSize: 11, color: brand.danger }}>{saveError}</div>
            )}
            <div style={{ fontSize: 10, color: brand.textMuted }}>
              Staff override — enter 0–{sessionsTotal}. This updates the credit balance immediately.
            </div>
          </div>
        ) : (
          <button
            onClick={handleEdit}
            style={{
              width: '100%',
              padding: '7px 0',
              borderRadius: 6,
              border: `1px solid ${brand.border}`,
              background: 'transparent',
              color: brand.textMuted,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}
          >
            Override sessions remaining
          </button>
        )}
      </OCard>
    </div>
  );
}

function EftWeeklyCreditsSection({ member }: { member: MemberDetail }) {
  if (
    member.planType !== 'eft' ||
    member.weeklyTotal === null ||
    member.weeklySessionsUsed === null
  ) return null;

  const used    = member.weeklySessionsUsed;
  const total   = member.weeklyTotal;
  const remaining = Math.max(0, total - used);
  const pct     = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const monday  = member.weeklyPeriodStart;

  return (
    <div>
      <SectionHeader title="Weekly Credits" />
      <OCard style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Package size={14} color={brand.gold} />
          <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            {member.program}
          </span>
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{
              fontSize: 24,
              fontWeight: 800,
              fontFamily: fonts.display,
              color: remaining === 0 ? brand.danger : brand.text,
            }}>
              {remaining}
            </span>
            <span style={{ fontSize: 11, color: brand.textMuted }}>
              of {total} remaining this week
            </span>
          </div>
          <div style={{ height: 6, background: brand.surfaceAlt, borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: remaining === 0 ? brand.danger : brand.success,
              borderRadius: 4,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {monday && (
          <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 8 }}>
            Week starting {monday} · Resets every Monday.
          </div>
        )}
      </OCard>
    </div>
  );
}

function ChangeBillingDateSection({ member }: { member: MemberDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(member.billingAnchorDay ?? 1);
  const [changeType, setChangeType] = useState<'permanent' | 'one_time'>('permanent');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ effectiveDate: string; changeType: string; newDay: number } | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleOpen = useCallback(() => {
    setSelectedDay(member.billingAnchorDay ?? 1);
    setChangeType('permanent');
    setSaveErr(null);
    setResult(null);
    setOpen(true);
  }, [member.billingAnchorDay]);

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch(`/api/owner/memberships/${member.id}/billing-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_anchor_day: selectedDay, change_type: changeType }),
      });
      const data = await res.json() as {
        ok?: boolean;
        effective_date?: string;
        change_type?: string;
        new_anchor_day?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setSaveErr(data.error ?? `Error ${res.status}`);
      } else {
        setResult({
          effectiveDate: data.effective_date ?? '',
          changeType: data.change_type ?? changeType,
          newDay: data.new_anchor_day ?? selectedDay,
        });
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [member.id, selectedDay, changeType, router]);

  if (member.planType !== 'eft' || !member.stripeSubscriptionId) return null;

  const currentDay = member.billingAnchorDay;
  const currentDayLabel = currentDay ? `${currentDay}${['th','st','nd','rd'][((currentDay % 100 - 20) % 10)] ?? ['th','st','nd','rd'][currentDay % 100] ?? 'th'} of each month` : '—';

  if (result) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const d = new Date(result.effectiveDate + 'T00:00:00');
    const dateStr = isNaN(d.getTime()) ? result.effectiveDate : `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    const newDayOrdinal = `${result.newDay}${['th','st','nd','rd'][((result.newDay % 100 - 20) % 10)] ?? ['th','st','nd','rd'][result.newDay % 100] ?? 'th'}`;
    const origDay = member.billingAnchorDay ?? result.newDay;
    const origDayOrdinal = `${origDay}${['th','st','nd','rd'][((origDay % 100 - 20) % 10)] ?? ['th','st','nd','rd'][origDay % 100] ?? 'th'}`;
    return (
      <div>
        <SectionHeader title="Billing Date" />
        <OCard style={{ padding: 14, borderLeft: `4px solid ${brand.success}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} color={brand.success} />
            <span style={{ fontSize: 13, fontWeight: 700, color: brand.success }}>
              Billing date updated
            </span>
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 6, lineHeight: 1.6 }}>
            {result.changeType === 'permanent'
              ? `Billing date changed to the ${newDayOrdinal} of each month, effective ${dateStr}.`
              : `Next payment moved to ${dateStr}. Future payments will continue on the ${origDayOrdinal} as normal.`}
          </div>
          <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 4 }}>
            A confirmation email has been sent to the parent.
          </div>
          <button
            onClick={() => { setResult(null); handleOpen(); }}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 6, marginTop: 10,
              border: `1px solid ${brand.border}`, background: 'transparent',
              color: brand.textMuted, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Change billing date again
          </button>
        </OCard>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Billing Date" />
      <OCard style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Calendar size={14} color={brand.gold} />
          <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1 }}>
            Current anchor
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: brand.text, marginLeft: 4 }}>
            {currentDayLabel}
          </span>
        </div>

        {!open ? (
          <button
            onClick={handleOpen}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 6,
              border: `1px solid ${brand.border}`, background: 'transparent',
              color: brand.textMuted, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', letterSpacing: 0.5,
            }}
          >
            Change billing date
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                New billing day (1–28)
              </div>
              <select
                ref={selectRef}
                value={selectedDay}
                onChange={e => setSelectedDay(Number(e.target.value))}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${brand.border}`, background: brand.surfaceAlt,
                  color: brand.text, fontSize: 13, fontWeight: 700, outline: 'none',
                }}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, marginBottom: 4 }}>
                Applies to
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(['permanent', 'one_time'] as const).map(opt => (
                  <label
                    key={opt}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="change_type"
                      value={opt}
                      checked={changeType === opt}
                      onChange={() => setChangeType(opt)}
                      style={{ marginTop: 2, accentColor: brand.gold }}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: brand.text }}>
                        {opt === 'permanent' ? 'All future payments' : 'Next payment only'}
                      </div>
                      <div style={{ fontSize: 10, color: brand.textMuted }}>
                        {opt === 'permanent'
                          ? 'Permanently shifts the billing anchor to the new day.'
                          : 'Moves just the next charge; billing returns to the current day after that.'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {saveErr && (
              <div style={{
                padding: '8px 10px', background: brand.dangerBg, borderRadius: 6,
                fontSize: 12, color: brand.danger,
              }}>
                {saveErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <OButton
                variant="gold"
                size="sm"
                onClick={handleSubmit}
                disabled={saving}
                style={{ flex: 1 }}
              >
                {saving ? 'Saving…' : 'Confirm change'}
              </OButton>
              <OButton
                variant="secondary"
                size="sm"
                onClick={() => { setOpen(false); setSaveErr(null); }}
                disabled={saving}
                style={{ flex: 1 }}
              >
                Cancel
              </OButton>
            </div>
            <div style={{ fontSize: 10, color: brand.textMuted }}>
              A confirmation email will be sent to the parent.
            </div>
          </div>
        )}
      </OCard>
    </div>
  );
}

function SubscriptionSection({ member }: { member: MemberDetail }) {
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState<string | null>(null);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateDone, setActivateDone] = useState<{ subId: string; nextBilling: string | null } | null>(null);
  const [activateErr, setActivateErr] = useState<string | null>(null);

  // ── Promo code state ───────────────────────────────────────────────────────
  const [promoInput, setPromoInput] = useState('');
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoValid, setPromoValid] = useState<{
    discountType: 'percent' | 'fixed';
    discountValue: number;
    code: string;
  } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);

  const handleValidatePromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoValidating(true);
    setPromoErr(null);
    setPromoValid(null);
    try {
      const res = await fetch('/api/admin/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, plan_name: member.program }),
      });
      const data = await res.json() as {
        ok?: boolean;
        error_code?: string;
        discount_type?: 'percent' | 'fixed';
        discount_value?: number;
        code?: string;
        error?: string;
      };
      if (!res.ok) {
        setPromoErr(data.error ?? 'Validation failed');
      } else if (!data.ok) {
        const msgs: Record<string, string> = {
          INVALID: 'This code is invalid.',
          EXPIRED: 'This code has expired.',
          EXHAUSTED: 'This code has reached its maximum number of uses.',
          PLAN_MISMATCH: 'This code does not apply to this plan.',
        };
        setPromoErr(msgs[data.error_code ?? 'INVALID'] ?? 'This code is invalid.');
      } else {
        setPromoValid({
          discountType: data.discount_type!,
          discountValue: data.discount_value!,
          code: data.code!,
        });
      }
    } catch {
      setPromoErr('Could not validate code. Try again.');
    } finally {
      setPromoValidating(false);
    }
  }, [promoInput, member.program]);

  const handleCancel = useCallback(async () => {
    if (!confirm('Cancel this subscription at the end of the current billing period? The member will keep access until then.')) return;

    setCancelling(true);
    setCancelErr(null);
    try {
      const res = await fetch('/api/stripe/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membership_id: member.id }),
      });
      const data = await res.json() as { ok?: boolean; cancel_at?: string; error?: string };
      if (!res.ok || !data.ok) {
        setCancelErr(data.error ?? `Error ${res.status}`);
      } else {
        const label = data.cancel_at
          ? `Cancels ${formatNextBilling(data.cancel_at)}`
          : 'Cancelled';
        setCancelDone(label);
      }
    } catch (err) {
      setCancelErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCancelling(false);
    }
  }, [member.id]);

  const handleActivate = useCallback(async () => {
    const promoLabel = promoValid
      ? ` with promo code ${promoValid.code}`
      : '';
    if (!confirm(`Activate this membership${promoLabel} and start automated Stripe billing? If the family has a saved payment card, Stripe will be set up automatically.`)) return;

    setActivating(true);
    setActivateErr(null);
    try {
      // POST /api/memberships/activate — combined endpoint that:
      //   1. Validates promo code if provided
      //   2. Marks membership active
      //   3. Automatically creates Stripe Subscription if family has stripe_customer_id
      // This eliminates the need for a separate manual "link billing" step.
      const reqBody: Record<string, unknown> = { membership_id: member.id };
      if (promoValid) reqBody.promo_code = promoValid.code;

      const res = await fetch('/api/memberships/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json() as {
        ok?: boolean;
        subscription_id?: string;
        next_billing_at?: string;
        stripe_skipped?: boolean;
        stripe_error?: string;
        reason?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setActivateErr(typeof data.error === 'string' ? data.error : `Error ${res.status}`);
      } else if (data.stripe_skipped) {
        // Membership activated but Stripe subscription not yet linked:
        // family hasn't saved a payment card yet (or plan is not EFT).
        setActivateDone({ subId: '', nextBilling: null });
      } else {
        setActivateDone({
          subId: data.subscription_id ?? '',
          nextBilling: data.next_billing_at ?? null,
        });
      }
    } catch (err) {
      setActivateErr(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActivating(false);
    }
  }, [member.id, promoValid]);

  const { subscriptionStatus, nextBillingAt, stripeSubscriptionId, cancelAt: persistedCancelAt,
          cancelRequestedAt, cancelEffectiveAt } = member;

  // If DB already has a cancel_at (persisted when cancel was first triggered),
  // pre-populate cancelDone so the "Cancels on <date>" label survives page reloads.
  // We only set it once on mount — if the admin cancels again in this session,
  // the handleCancel callback will overwrite it via setCancelDone.
  const persistedCancelLabel = persistedCancelAt
    ? `Cancels ${formatNextBilling(persistedCancelAt)}`
    : null;

  // Use in-session cancelDone if set, otherwise fall back to persisted DB value.
  const effectiveCancelDone = cancelDone ?? persistedCancelLabel;

  // ── No subscription yet — offer to activate ──────────────────────────────
  if (subscriptionStatus === 'none' && !activateDone) {
    const discountLabel = promoValid
      ? promoValid.discountType === 'percent'
        ? `${promoValid.discountValue}% off first month`
        : `$${(promoValid.discountValue / 100).toFixed(2)} off first month`
      : null;

    return (
      <div>
        <SectionHeader title="Subscription" />
        <OCard style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 12 }}>
            No Stripe subscription linked yet. Activating will mark the membership active
            and automatically start recurring billing on Stripe — provided the family has
            saved a payment card in Clubhouse by Infinite Hitting (Me → Payment Method).
          </div>

          {/* ── Promo code input ───────────────────────────────────────── */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 10, color: brand.textMuted, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
            }}>
              Promo Code <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase());
                  setPromoValid(null);
                  setPromoErr(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleValidatePromo(); } }}
                placeholder="e.g. SUMMER25"
                maxLength={50}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 8,
                  border: `1px solid ${promoValid ? brand.success : promoErr ? brand.danger : brand.border}`,
                  background: brand.surface, color: brand.text,
                  fontSize: 13, fontFamily: 'monospace', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => { void handleValidatePromo(); }}
                disabled={promoValidating || !promoInput.trim()}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: `1px solid ${brand.border}`,
                  background: brand.surface, color: brand.text,
                  fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                  opacity: promoValidating || !promoInput.trim() ? 0.5 : 1,
                }}
              >
                {promoValidating ? 'Checking…' : 'Apply'}
              </button>
            </div>
            {promoValid && (
              <div style={{
                marginTop: 6, padding: '6px 10px', borderRadius: 8,
                background: `${brand.success}18`, border: `1px solid ${brand.success}40`,
                fontSize: 12, color: brand.success,
              }}>
                ✓ <strong>{promoValid.code}</strong> applied — {discountLabel}
              </div>
            )}
            {promoErr && (
              <div style={{ marginTop: 6, fontSize: 11, color: brand.danger }}>{promoErr}</div>
            )}
          </div>

          {activateErr && (
            <div style={{ fontSize: 11, color: brand.danger, marginBottom: 8 }}>{activateErr}</div>
          )}
          <OButton
            variant="gold"
            size="sm"
            icon={CreditCard}
            onClick={handleActivate}
            disabled={activating}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {activating ? 'Activating…' : promoValid ? `Activate with ${promoValid.code}` : 'Activate & Start Billing'}
          </OButton>
        </OCard>
      </div>
    );
  }

  // ── Just activated ────────────────────────────────────────────────────────
  if (activateDone) {
    return (
      <div>
        <SectionHeader title="Subscription" />
        <OCard style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Chip color="success">Active</Chip>
          </div>
          <div style={{ fontSize: 12, color: brand.textMuted }}>
            Subscription activated. Next billing: {formatNextBilling(activateDone.nextBilling)}.
          </div>
          <div style={{
            marginTop: 8, fontSize: 10, color: brand.textMuted,
            fontFamily: fonts.mono, wordBreak: 'break-all',
          }}>
            {activateDone.subId}
          </div>
        </OCard>
      </div>
    );
  }

  const statusColor = subscriptionStatus === 'active' ? 'success'
    : subscriptionStatus === 'payment_overdue' ? 'danger'
    : subscriptionStatus === 'cancelled' ? 'warning'
    : 'default' as const;

  const statusLabel = subscriptionStatus === 'payment_overdue' ? 'Payment Overdue'
    : subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1);

  const canCancel = (subscriptionStatus === 'active' || subscriptionStatus === 'payment_overdue')
    && !effectiveCancelDone;

  return (
    <div>
      <SectionHeader title="Subscription" />
      <OCard style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Chip color={statusColor as 'success' | 'warning' | 'danger' | 'default'}>{statusLabel}</Chip>
          {subscriptionStatus === 'payment_overdue' && (
            <AlertCircle size={14} color={brand.danger} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: brand.textMuted }}>Monthly amount</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: brand.text }}>
              {member.mrr > 0 ? `$${member.mrr.toFixed(2)}/mo` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: brand.textMuted }}>Next billing</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: brand.text }}>
              {effectiveCancelDone ? '—' : formatNextBilling(nextBillingAt)}
            </span>
          </div>
          {!effectiveCancelDone && nextBillingAt && member.billingAnchorDay
            && new Date(nextBillingAt + 'T00:00:00').getUTCDate() !== member.billingAnchorDay && (
            <div style={{
              fontSize: 10, color: brand.textMuted, background: brand.surfaceAlt,
              borderRadius: 6, padding: '6px 8px', lineHeight: 1.5,
            }}>
              One-time override: this next charge only. Future payments resume on the{' '}
              {member.billingAnchorDay}
              {['th','st','nd','rd'][((member.billingAnchorDay % 100 - 20) % 10)] ?? ['th','st','nd','rd'][member.billingAnchorDay % 100] ?? 'th'} as usual.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: brand.textMuted }}>Stripe sub</span>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: brand.textMuted,
              fontFamily: 'monospace',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {stripeSubscriptionId ?? '—'}
            </span>
          </div>
        </div>

        {cancelRequestedAt && subscriptionStatus !== 'cancelled' && (
          <div style={{
            padding: '10px 12px',
            background: 'rgba(255,193,7,0.08)',
            borderRadius: 6,
            border: '1px solid rgba(255,193,7,0.25)',
            marginBottom: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <AlertCircle size={13} color="#FFC107" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#FFC107' }}>Cancellation Pending</span>
            </div>
            <div style={{ fontSize: 11, color: brand.textMuted, lineHeight: 1.5 }}>
              Requested {formatNextBilling(cancelRequestedAt ?? null)}
              {cancelEffectiveAt && (
                <span> · Access ends <strong style={{ color: brand.text }}>{formatNextBilling(cancelEffectiveAt ?? null)}</strong></span>
              )}
            </div>
          </div>
        )}

        {effectiveCancelDone && (
          <div style={{
            padding: '8px 10px',
            background: brand.surfaceAlt,
            borderRadius: 6,
            fontSize: 12,
            color: brand.success,
            fontWeight: 600,
            marginBottom: 8,
          }}>
            {effectiveCancelDone}
          </div>
        )}

        {cancelErr && (
          <div style={{
            padding: '8px 10px',
            background: brand.dangerBg,
            borderRadius: 6,
            fontSize: 12,
            color: brand.danger,
            marginBottom: 8,
          }}>
            {cancelErr}
          </div>
        )}

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              width: '100%',
              padding: '8px 0',
              borderRadius: 6,
              border: `1px solid ${brand.danger}`,
              background: 'transparent',
              color: brand.danger,
              fontSize: 12,
              fontWeight: 700,
              cursor: cancelling ? 'not-allowed' : 'pointer',
              opacity: cancelling ? 0.6 : 1,
              letterSpacing: 0.5,
            }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
          </button>
        )}
      </OCard>
    </div>
  );
}

export function MemberDetailContent({ member: initialMember, waiverStatus, waiverSignedAt }: Props) {
  const [m, setM] = useState(initialMember);
  const [activeModal, setActiveModal] = useState<'message' | 'edit' | 'book' | null>(null);

  useEffect(() => {
    setM(initialMember);
  }, [initialMember]);

  const demo = isDemo(m) ? m : null;
  const mo = demo ? demo.memberForMonths : monthsAgo(m.joinedDate);

  const rawMemberStatus = m.status as string;
  const statusChipColor = rawMemberStatus === 'active' ? 'success'
    : rawMemberStatus === 'paused' ? 'warning'
    : rawMemberStatus === 'payment_overdue' ? 'danger'
    : 'danger';

  return (
    <div>
      <PageHeader
        breadcrumb={`Members → ${m.name}`}
        title={m.name}
        subtitle={`${m.age} · ${m.program} · Member for ${mo} months · ${m.bookingCount} total sessions · LTV $${m.lifetime.toLocaleString()}`}
        actions={
          <>
            <OButton variant="secondary" icon={MessageCircle} onClick={() => setActiveModal('message')}>Message</OButton>
            <OButton variant="secondary" icon={Edit2} onClick={() => setActiveModal('edit')}>Edit</OButton>
            <OButton variant="gold" icon={Calendar} onClick={() => setActiveModal('book')}>Book Session</OButton>
          </>
        }
      />

      {activeModal === 'message' && (
        <MessageModal member={m} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === 'edit' && (
        <EditMemberModal
          member={m}
          onClose={() => setActiveModal(null)}
          onSaved={updates => {
            setM(prev => ({
              ...prev,
              parent: [updates.parentFirstName, updates.parentLastName].filter(Boolean).join(' '),
              parentFirstName: updates.parentFirstName,
              parentLastName: updates.parentLastName,
              parentEmail: updates.parentEmail,
              parentPhone: updates.parentPhone ?? '',
              program: updates.program,
            }));
            setActiveModal(null);
          }}
        />
      )}
      {activeModal === 'book' && (
        <BookSessionModal member={m} onClose={() => setActiveModal(null)} />
      )}

      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* ── Left column ── */}
        <div>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
            <a
              href="#lesson-history"
              aria-label={`View session history: ${m.bookingCount} completed sessions`}
              style={{ color: 'inherit', textDecoration: 'none', borderRadius: 10 }}
            >
              <KPIBlock label="Sessions Done" value={m.bookingCount} sub="completed · view history" />
            </a>
            <KPIBlock label="Member For" value={mo} sub="months" />
            <KPIBlock label="Engagement" value={m.engagementScore} sub="out of 100" highlight={m.engagementScore >= 70} />
            <KPIBlock label="Best Velo" value={demo ? `${demo.bestVeloMph} mph` : '—'} sub="exit velocity" highlight />
            <KPIBlock label="Homework" value={demo ? `${demo.homeworkScore}/10` : '—'} sub="completion" />
          </div>

          {/* HitTrax Performance */}
          {demo && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <SectionHeader title="HitTrax Performance" />
                <span style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 600, cursor: 'pointer' }}>VIEW ALL SWINGS</span>
              </div>
              <OCard style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Avg Exit Velo</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginTop: 2 }}>
                      {demo.hittraxAvgExitVelo} <span style={{ fontSize: 13, color: brand.textMuted }}>mph</span>
                    </div>
                    <div style={{ fontSize: 11, color: brand.success, marginTop: 2 }}>▲ +4 mph this quarter</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Best</div>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: fonts.display, color: brand.success, marginTop: 2 }}>
                      {demo.hittraxBestVelo} <span style={{ fontSize: 13, color: brand.textMuted }}>mph</span>
                    </div>
                  </div>
                </div>
                <Sparkline points={demo.sparklinePoints} />
              </OCard>
            </div>
          )}

          {/* Activity Timeline */}
          <SectionHeader title="Activity Timeline" />
          <OCard>
            {m.timeline.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: brand.textMuted, fontSize: 12 }}>
                No activity on record yet.
              </div>
            ) : (
              m.timeline.map((evt, i) => {
                const isLast = i === m.timeline.length - 1;
                const isPmt = evt.kind === 'payment';
                const isGood = evt.status === 'completed' || evt.status === 'paid';
                const isBad = evt.status === 'cancelled' || evt.status === 'failed';
                const Icon = isPmt
                  ? (isGood ? CheckCircle : isBad ? XCircle : CreditCard)
                  : (isGood ? CheckCircle : isBad ? XCircle : Clock);
                const iconColor = isGood ? brand.success : isBad ? brand.danger : brand.textMuted;

                return (
                  <div
                    key={evt.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: !isLast ? `1px solid ${brand.border}` : undefined,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 15,
                        background: isGood ? brand.successBg : isBad ? brand.dangerBg : brand.surfaceAlt,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={14} color={iconColor} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: brand.text, fontSize: 13 }}>{evt.title}</div>
                        <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 1 }}>{evt.subtitle}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: brand.textMuted, flexShrink: 0, marginLeft: 12 }}>
                      {evt.dateLabel}
                    </div>
                  </div>
                );
              })
            )}
          </OCard>

          {/* Risk assessment */}
          {m.riskReason && (
            <div style={{ marginTop: 20 }}>
              <SectionHeader title="Risk Assessment" />
              <OCard style={{ borderLeft: `4px solid ${m.churnRisk === 'high' ? brand.danger : brand.warning}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.6, padding: '4px 0' }}>{m.riskReason}</div>
              </OCard>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Contact */}
          <div>
            <SectionHeader title="Contact" />
            <OCard style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoRow label="Parent" value={m.parent} large />
                <div>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Email</div>
                  {m.parentEmail ? (
                    <a
                      href={`mailto:${m.parentEmail}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: brand.gold, textDecoration: 'none', fontWeight: 500 }}
                    >
                      <Mail size={12} />
                      {m.parentEmail}
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: brand.textMuted }}>—</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Phone</div>
                  {m.parentPhone ? (
                    <a
                      href={`tel:${m.parentPhone}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: brand.gold, textDecoration: 'none', fontWeight: 500 }}
                    >
                      <Phone size={12} />
                      {m.parentPhone}
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: brand.textMuted }}>—</div>
                  )}
                </div>
              </div>
            </OCard>
          </div>

          {/* Membership Agreement */}
          <div>
            <SectionHeader title="Membership Agreement" />
            <OCard style={{ padding: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {waiverStatus === 'signed' ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={13} color={brand.success} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: brand.success }}>Signed</span>
                    </div>
                    {waiverSignedAt && (
                      <div style={{ fontSize: 11, color: brand.textMuted }}>
                        {new Date(waiverSignedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    )}
                    {!isDemo(m) && (
                      <a
                        href={`/api/admin/waivers/${m.familyId}/pdf`}
                        download
                        style={{ fontSize: 12, color: brand.gold, textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Download PDF
                      </a>
                    )}
                  </>
                ) : waiverStatus === 'outdated' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={13} color={brand.warning} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: brand.warning }}>Outdated — re-sign needed</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <XCircle size={13} color={brand.danger} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: brand.danger }}>Not signed</span>
                  </div>
                )}
              </div>
            </OCard>
          </div>

          {/* Status chips */}
          <div>
            <SectionHeader title="Status" />
            <OCard style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Chip color={statusChipColor as 'success' | 'warning' | 'danger'}>
                  {rawMemberStatus === 'payment_overdue' ? 'Payment Overdue' : rawMemberStatus}
                </Chip>
                <Chip color={m.churnRisk === 'low' ? 'success' : m.churnRisk === 'medium' ? 'warning' : 'danger'}>
                  Risk: {m.churnRisk}
                </Chip>
              </div>
              <div style={{ fontSize: 11, color: brand.textMuted, lineHeight: 1.7 }}>
                Engagement: <strong style={{ color: brand.text }}>{m.engagementScore}/100</strong>
                <br />Last session: <strong style={{ color: brand.text }}>{m.lastSession}</strong>
              </div>
            </OCard>
          </div>

          {/* Billing */}
          <div>
            <SectionHeader title="Billing" />
            <OCard style={{ padding: 16 }}>
              <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1 }}>CURRENT PLAN</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, fontFamily: fonts.display }}>{m.program.toUpperCase()}</div>
              {m.planType === 'eft' ? (
                <div style={{ fontSize: 24, fontWeight: 800, fontFamily: fonts.display, color: brand.text, marginTop: 6 }}>
                  ${m.mrr}<span style={{ fontSize: 12, color: brand.textMuted, fontWeight: 400 }}>/mo</span>
                </div>
              ) : (
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.text, marginTop: 6 }}>
                  ${m.lifetime.toLocaleString()} <span style={{ fontSize: 11, color: brand.textMuted, fontWeight: 400 }}>one-time</span>
                </div>
              )}
              <div style={{ marginTop: 12, padding: 10, background: brand.surfaceAlt, borderRadius: 8 }}>
                {[
                  { label: 'Next charge', value: m.nextCharge },
                  { label: 'Method', value: demo?.paymentMethod ?? '—' },
                  { label: 'Auto-pay', value: m.planType === 'eft' ? 'ON' : '—' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? 8 : 0 }}>
                    <div style={{ fontSize: 11, color: brand.textMuted }}>{row.label}</div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      color: row.value === 'Overdue' ? brand.danger : row.value === 'ON' ? brand.success : brand.text,
                    }}>
                      {row.value === 'ON' ? (
                        <span style={{ background: brand.successBg, color: brand.success, padding: '2px 8px', borderRadius: 4, fontSize: 10 }}>ON</span>
                      ) : row.value}
                    </div>
                  </div>
                ))}
              </div>

              {m.recentPayments.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>RECENT PAYMENTS</div>
                  {m.recentPayments.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '7px 0',
                        borderTop: i > 0 ? `1px solid ${brand.border}` : undefined,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: brand.text }}>${p.amount.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: brand.textMuted }}>{p.date} · {p.method}</div>
                      </div>
                      <Chip color={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'} size="sm">
                        {p.status}
                      </Chip>
                    </div>
                  ))}
                </div>
              )}
            </OCard>
          </div>

          {/* Pause window (Task #240) */}
          {!demo && (m as MemberDetail).subscriptionStatus === 'paused' && (m as MemberDetail).pauseEnd && (
            <PauseSection member={m as MemberDetail} />
          )}

          {/* Session Pack credits — OTC members only (Task #237) */}
          {!demo && (
            <SessionsOverrideSection member={m as MemberDetail} />
          )}

          {/* Weekly credit usage — EFT limited members only */}
          {!demo && (
            <EftWeeklyCreditsSection member={m as MemberDetail} />
          )}

          {/* Billing date change — EFT with active subscription only */}
          {!demo && (m as MemberDetail).planType === 'eft' &&
           (m as MemberDetail).stripeSubscriptionId &&
           (m as MemberDetail).subscriptionStatus !== 'paused' && (
            <ChangeBillingDateSection member={m as MemberDetail} />
          )}

          {/* Subscription (Phase 3) */}
          {!demo && (m as MemberDetail).subscriptionStatus !== 'paused' && (
            <SubscriptionSection member={m as MemberDetail} />
          )}

          {/* Scheduled balance payments (split OTC) */}
          {!demo && (m as MemberDetail).scheduledCharges?.length > 0 && (
            <ScheduledChargesSection charges={(m as MemberDetail).scheduledCharges} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Scheduled Charges Section (split OTC balance payments) ────────────────────

function ScheduledChargesSection({ charges }: { charges: import('@/lib/supabase/ownerQueries').ScheduledChargeRow[] }) {
  const hasPending = charges.some(c => c.status === 'pending');
  const hasFailed = charges.some(c => c.status === 'failed');

  return (
    <div style={{ marginTop: 2 }}>
      <SectionHeader title="Scheduled Payments" />
      <OCard style={{ padding: 0, overflow: 'hidden' }}>
        {hasFailed && (
          <div style={{
            padding: '10px 14px',
            background: brand.dangerBg,
            borderBottom: `1px solid ${brand.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={13} color={brand.danger} />
            <span style={{ fontSize: 12, color: brand.danger, fontWeight: 600 }}>
              One or more balance payments failed — contact the family to collect manually.
            </span>
          </div>
        )}
        {hasPending && !hasFailed && (
          <div style={{
            padding: '8px 14px',
            background: 'rgba(241,229,173,0.06)',
            borderBottom: `1px solid ${brand.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Clock size={12} color={brand.goldDeep} />
            <span style={{ fontSize: 11, color: brand.goldDeep }}>
              Balance will be collected automatically on the due date.
            </span>
          </div>
        )}
        {charges.map((charge, i) => {
          const isLast = i === charges.length - 1;
          const statusColor = charge.status === 'paid' ? brand.success
            : charge.status === 'failed' ? brand.danger
            : brand.goldDeep;
          const statusBg = charge.status === 'paid' ? brand.successBg
            : charge.status === 'failed' ? brand.dangerBg
            : 'rgba(241,229,173,0.08)';

          return (
            <div
              key={charge.id}
              style={{
                padding: '12px 16px',
                borderBottom: !isLast ? `1px solid ${brand.border}` : undefined,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: brand.text }}>
                  ${(charge.amount_cents / 100).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>
                  Due {charge.charge_date}
                </div>
                {charge.failure_reason && (
                  <div style={{ fontSize: 10, color: brand.danger, marginTop: 2 }}>
                    {charge.failure_reason}
                  </div>
                )}
              </div>
              <span style={{
                padding: '3px 9px', borderRadius: 12,
                fontSize: 10, fontWeight: 700, background: statusBg, color: statusColor,
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {charge.status}
              </span>
            </div>
          );
        })}
      </OCard>
    </div>
  );
}
