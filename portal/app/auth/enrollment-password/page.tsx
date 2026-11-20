'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';

import { brand, fonts } from '@/lib/ownerBrandTokens';

export default function EnrollmentPasswordPage() {
  const [tokenHash, setTokenHash] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const tokenRead = useRef(false);

  useEffect(() => {
    if (tokenRead.current) return;
    tokenRead.current = true;
    const hash = new URLSearchParams(window.location.search).get('token_hash') ?? '';
    setTokenHash(hash);
    setTokenReady(true);
    if (hash) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!tokenHash) {
      setError('This password link is missing or has expired. Ask the front desk to send a new enrollment link.');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError('Choose a password between 8 and 128 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/enrollment-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, password }),
      });
      const body = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) {
        const returnedMessage = body?.error || 'We could not save your password. Please try again.';
        const tokenEchoed = [tokenHash, encodeURIComponent(tokenHash)].some(value => returnedMessage.includes(value));
        setError(tokenEchoed ? 'We could not save your password. Please try again or ask the front desk for a new link.' : returnedMessage);
        return;
      }
      setSaved(true);
      setTokenHash('');
      setPassword('');
      setConfirmation('');
    } catch {
      setError('We could not reach Clubhouse. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 48,
    boxSizing: 'border-box',
    padding: '0 14px',
    color: brand.text,
    background: brand.surfaceAlt,
    border: `1px solid ${brand.borderStrong}`,
    borderRadius: 9,
    fontFamily: fonts.body,
    fontSize: 15,
    outlineColor: brand.goldDeep,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: brand.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 7,
    textTransform: 'uppercase',
  };

  return (
    <main style={{
      minHeight: '100dvh',
      boxSizing: 'border-box',
      display: 'grid',
      placeItems: 'center',
      padding: '28px 18px',
      background: brand.darkest,
      color: brand.text,
      fontFamily: fonts.body,
    }}>
      <section style={{
        width: '100%',
        maxWidth: 460,
        overflow: 'hidden',
        border: `1px solid ${brand.border}`,
        borderRadius: 16,
        background: brand.surface,
        boxShadow: '0 24px 72px rgba(0,0,0,0.28)',
      }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '26px 28px',
          borderBottom: `1px solid ${brand.border}`,
        }}>
          <div style={{
            width: 44,
            height: 44,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 12,
            color: brand.gold,
            background: 'rgba(241,229,173,0.10)',
          }}>
            {saved ? <CheckCircle2 size={22} /> : <KeyRound size={22} />}
          </div>
          <div>
            <p style={{ margin: '0 0 3px', color: brand.goldDeep, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              Clubhouse family account
            </p>
            <h1 style={{ margin: 0, color: brand.text, fontFamily: fonts.display, fontSize: 26, lineHeight: 1.15 }}>
              {saved ? 'Password saved' : 'Set your password'}
            </h1>
          </div>
        </header>

        {saved ? (
          <div style={{ padding: '28px' }}>
            <p style={{ margin: '0 0 18px', color: brand.text, fontSize: 15, lineHeight: 1.65 }}>
              Your password is saved. Sign in to the Clubhouse mobile app with the parent email address used for enrollment and this password.
            </p>
            <p style={{ margin: 0, color: brand.textMuted, fontSize: 13, lineHeight: 1.6 }}>
              You can close this page and continue in the app.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '26px 28px 30px' }}>
            <p style={{ margin: '0 0 22px', color: brand.textMuted, fontSize: 14, lineHeight: 1.6 }}>
              Create a password for the parent account. You will use it to sign in to Clubhouse on your phone.
            </p>

            {!tokenReady ? (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, color: brand.textMuted, background: brand.surfaceAlt, borderRadius: 9, fontSize: 13 }}>
                <LoaderCircle size={16} /> Checking your secure link…
              </div>
            ) : !tokenHash ? (
              <div role="alert" style={{ padding: '12px 14px', borderRadius: 9, color: brand.warning, background: brand.warningBg, fontSize: 13, lineHeight: 1.55 }}>
                This password link is missing or has expired. Ask the front desk to send a new enrollment link.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 18 }}>
                  <label htmlFor="enrollment-password" style={labelStyle}>New password</label>
                  <input
                    id="enrollment-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    style={inputStyle}
                  />
                  <p style={{ margin: '7px 0 0', color: brand.textMuted, fontSize: 11 }}>Use 8–128 characters.</p>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="enrollment-password-confirm" style={labelStyle}>Confirm password</label>
                  <input
                    id="enrollment-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmation}
                    onChange={event => setConfirmation(event.target.value)}
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            {error ? (
              <div role="alert" style={{
                marginBottom: 18,
                padding: '11px 14px',
                borderRadius: 9,
                color: brand.danger,
                background: brand.dangerBg,
                fontSize: 13,
                lineHeight: 1.5,
              }}>
                {error}
              </div>
            ) : null}

            {tokenReady && tokenHash ? (
              <button
                type="submit"
                disabled={submitting || !password || !confirmation}
                style={{
                  width: '100%',
                  minHeight: 50,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  border: 0,
                  borderRadius: 9,
                  background: submitting ? brand.goldDeep : brand.gold,
                  color: brand.darker,
                  fontFamily: fonts.display,
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? <LoaderCircle size={16} /> : null}
                {submitting ? 'Saving password…' : 'Save password'}
              </button>
            ) : null}
          </form>
        )}
      </section>
      <p style={{ margin: '18px 0 0', color: brand.textMuted, fontSize: 11, textAlign: 'center' }}>
        Clubhouse by Infinite Hitting
      </p>
    </main>
  );
}
