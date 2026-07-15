'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import { brand, fonts } from '@/lib/ownerBrandTokens';

export function SetupContent() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const set = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/platform/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const body = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Setup failed');

      // Sign in immediately so the user lands on /hq.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInErr) throw new Error(`Account created but sign-in failed: ${signInErr.message}`);

      router.push('/hq');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', borderRadius: 8,
    border: `1px solid ${brand.border}`, background: brand.surface,
    fontSize: 14, color: brand.text, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: brand.textMuted, marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: 0.8,
  };

  return (
    <div style={{
      minHeight: '100vh', background: brand.darkest,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 16, width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: `1px solid ${brand.border}`,
      }}>
        {/* Header */}
        <div style={{
          padding: '28px 32px 24px',
          borderBottom: `1px solid ${brand.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: brand.goldDeep + '22',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={20} color={brand.goldDeep} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 20, fontWeight: 800,
              fontFamily: fonts.display, color: brand.text,
            }}>
              Platform Setup
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: brand.textMuted }}>
              Create the first super admin account
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          margin: '20px 32px 0',
          padding: '10px 14px', borderRadius: 8,
          background: brand.goldDeep + '14',
          border: `1px solid ${brand.goldDeep}30`,
          fontSize: 12, color: brand.goldDeep, lineHeight: 1.5,
        }}>
          This page is available only once, before the platform is initialized.
          It permanently disables itself after you create this account.
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 32px 32px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Full Name *</label>
            <input
              style={inputStyle} required autoFocus
              value={form.name} onChange={(e) => set('name', e.target.value)}
              placeholder="Alex Smith"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle} type="email" required
              value={form.email} onChange={(e) => set('email', e.target.value)}
              placeholder="admin@ballparkapp.com"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password *</label>
            <input
              style={inputStyle} type="password" required minLength={8}
              value={form.password} onChange={(e) => set('password', e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={labelStyle}>Confirm Password *</label>
            <input
              style={inputStyle} type="password" required minLength={8}
              value={form.confirm} onChange={(e) => set('confirm', e.target.value)}
              placeholder="Repeat password"
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: brand.dangerBg, color: brand.danger,
              fontSize: 13, marginBottom: 18,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 9, border: 'none',
              background: loading ? brand.border : brand.gold,
              color: brand.darker, fontWeight: 700, fontSize: 14,
              fontFamily: fonts.display, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading && <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            {loading ? 'Creating Account…' : 'Create Super Admin Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
