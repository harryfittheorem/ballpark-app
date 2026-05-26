'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Video, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import type { OwnerCoach } from '@/lib/supabase/ownerQueries';

type FamilyRecipient = {
  familyId: string;
  parentName: string;
  kids: { kidId: string; kidName: string }[];
};

type Props = {
  coach: OwnerCoach;
  tenantId: string;
  onClose: () => void;
};

type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export function CoachMessagePanel({ coach, tenantId, onClose }: Props) {
  const [families, setFamilies] = useState<FamilyRecipient[]>([]);
  const [familiesLoading, setFamiliesLoading] = useState(true);
  const [familiesError, setFamiliesError] = useState<string | null>(null);

  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [selectedKidId, setSelectedKidId] = useState('');
  const [messageText, setMessageText] = useState('');

  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/owner/families')
      .then((r) => r.json())
      .then((data: FamilyRecipient[] | { error: string }) => {
        if ('error' in data) {
          setFamiliesError(String(data.error));
        } else {
          setFamilies(data);
          if (data.length > 0) {
            setSelectedFamilyId(data[0].familyId);
            setSelectedKidId(data[0].kids[0]?.kidId ?? '');
          }
        }
      })
      .catch((e: unknown) => setFamiliesError(e instanceof Error ? e.message : 'Failed to load families.'))
      .finally(() => setFamiliesLoading(false));
  }, []);

  const selectedFamily = families.find((f) => f.familyId === selectedFamilyId) ?? null;

  const handleFamilyChange = (familyId: string) => {
    setSelectedFamilyId(familyId);
    const fam = families.find((f) => f.familyId === familyId);
    setSelectedKidId(fam?.kids[0]?.kidId ?? '');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState('uploading');
    setUploadPct(0);
    setUploadError(null);
    setVideoId(null);
    setVideoFileName(file.name);

    let uploadUrl: string;
    let vid: string;
    try {
      const mintRes = await fetch('/api/owner/coach-message-uploads', { method: 'POST' });
      if (!mintRes.ok) {
        const err = await mintRes.json() as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? `Upload service error (${mintRes.status})`);
      }
      const mintJson = await mintRes.json() as { upload_url: string; video_id: string };
      uploadUrl = mintJson.upload_url;
      vid = mintJson.video_id;
    } catch (err) {
      setUploadState('error');
      setUploadError(err instanceof Error ? err.message : 'Failed to start upload.');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Mux upload failed: HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during video upload.'));
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.send(file);
    }).then(() => {
      setVideoId(vid);
      setUploadState('done');
    }).catch((err: unknown) => {
      setUploadState('error');
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    });
  };

  const clearVideo = () => {
    setVideoId(null);
    setVideoFileName(null);
    setUploadState('idle');
    setUploadPct(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSend =
    !sending &&
    !sent &&
    !!selectedFamilyId &&
    !!selectedKidId &&
    (!!videoId || !!messageText.trim()) &&
    uploadState !== 'uploading';

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/owner/coach-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachUserId: coach.userId,
          familyId: selectedFamilyId,
          kidId: selectedKidId,
          tenantId,
          videoId: videoId ?? null,
          messageText: messageText.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        throw new Error(err?.error?.message ?? `Send failed (${res.status})`);
      }
      setSent(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 999,
        }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
        background: brand.surface, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${brand.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: brand.dark,
        }}>
          <div>
            <div style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase', marginBottom: 3 }}>
              Send Message
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.gold, letterSpacing: 0.3 }}>
              From {coach.name.toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: brand.textLight, padding: 4, lineHeight: 1 }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sent ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <CheckCircle size={48} color={brand.success} />
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.success }}>Message Sent!</div>
              <div style={{ fontSize: 13, color: brand.textMuted, textAlign: 'center' }}>
                The family will receive a notification and can view the message in the app.
              </div>
            </div>
          ) : (
            <>
              <div>
                <label style={labelStyle}>Recipient Family</label>
                {familiesLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: brand.textMuted, fontSize: 13 }}>
                    <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading families…
                  </div>
                ) : familiesError ? (
                  <div style={{ color: brand.danger, fontSize: 13 }}>{familiesError}</div>
                ) : families.length === 0 ? (
                  <div style={{ color: brand.textMuted, fontSize: 13 }}>No families found in this tenant.</div>
                ) : (
                  <select
                    value={selectedFamilyId}
                    onChange={(e) => handleFamilyChange(e.target.value)}
                    style={selectStyle}
                  >
                    {families.map((f) => (
                      <option key={f.familyId} value={f.familyId}>{f.parentName} family</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFamily && selectedFamily.kids.length > 1 && (
                <div>
                  <label style={labelStyle}>Kid</label>
                  <select
                    value={selectedKidId}
                    onChange={(e) => setSelectedKidId(e.target.value)}
                    style={selectStyle}
                  >
                    {selectedFamily.kids.map((k) => (
                      <option key={k.kidId} value={k.kidId}>{k.kidName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle}>Message</label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Write a note to the family… (optional if sending a video)"
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: 'vertical', minHeight: 90, lineHeight: 1.5,
                  }}
                />
              </div>

              <div>
                <label style={labelStyle}>Video (optional)</label>
                {uploadState === 'idle' && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 16px', border: `1.5px dashed ${brand.borderStrong}`,
                      borderRadius: 8, background: brand.surfaceAlt, cursor: 'pointer',
                      color: brand.textMuted, fontSize: 13, fontWeight: 600,
                      fontFamily: fonts.body, width: '100%',
                    }}
                  >
                    <Video size={16} /> Choose video file
                  </button>
                )}
                {uploadState === 'uploading' && (
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: brand.textMuted, fontSize: 13, marginBottom: 6 }}>
                      <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      Uploading {videoFileName}… {uploadPct}%
                    </div>
                    <div style={{ height: 4, background: brand.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${uploadPct}%`, height: '100%', background: brand.goldDeep, transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}
                {uploadState === 'done' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: brand.successBg, borderRadius: 8, border: `1px solid ${brand.success}` }}>
                    <CheckCircle size={14} color={brand.success} />
                    <span style={{ flex: 1, fontSize: 13, color: brand.success, fontWeight: 600 }}>{videoFileName}</span>
                    <button onClick={clearVideo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: brand.textMuted, padding: 0, lineHeight: 1 }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                {uploadState === 'error' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: brand.danger, fontSize: 13 }}>
                      <AlertCircle size={14} /> {uploadError}
                    </div>
                    <button onClick={clearVideo} style={{ ...btnStyle('secondary'), width: 'fit-content' }}>Try again</button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>

              {sendError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: brand.danger, fontSize: 13 }}>
                  <AlertCircle size={14} /> {sendError}
                </div>
              )}
            </>
          )}
        </div>

        {!sent && (
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${brand.border}`, display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={btnStyle('secondary')}>Cancel</button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{ ...btnStyle('gold'), flex: 1, opacity: canSend ? 1 : 0.5, cursor: canSend ? 'pointer' : 'not-allowed' }}
            >
              {sending ? (
                <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
              ) : (
                <><Send size={14} /> Send Message</>
              )}
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
  textTransform: 'uppercase', color: brand.textMuted, fontFamily: fonts.display,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '9px 12px',
  border: `1px solid ${brand.border}`, borderRadius: 8,
  fontSize: 14, fontFamily: fonts.body, color: brand.text,
  background: brand.surface, outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer', appearance: 'auto',
};

function btnStyle(variant: 'gold' | 'secondary' | 'primary'): React.CSSProperties {
  const variants = {
    gold: { background: brand.gold, color: brand.dark, border: `1px solid ${brand.gold}` },
    secondary: { background: brand.white, color: brand.darker, border: `1px solid ${brand.borderStrong}` },
    primary: { background: brand.dark, color: brand.gold, border: `1px solid ${brand.dark}` },
  };
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700,
    fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
    cursor: 'pointer', ...variants[variant],
  };
}
