import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { brand, fonts } from '@/lib/ownerBrandTokens';

interface Props {
  message: string;
  loginLink?: boolean;
}

export function ClaimError({ message, loginLink = false }: Props) {
  return (
    <div style={{
      minHeight: '100vh', background: brand.darkest,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: brand.surface, borderRadius: 16, width: '100%', maxWidth: 420,
        padding: '40px 36px', textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        border: `1px solid ${brand.border}`,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: brand.dangerBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <AlertTriangle size={24} color={brand.danger} />
        </div>
        <h2 style={{
          fontFamily: fonts.display, fontSize: 20, fontWeight: 800,
          color: brand.text, margin: '0 0 10px',
        }}>
          Invitation Invalid
        </h2>
        <p style={{ color: brand.textMuted, fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}>
          {message}
        </p>
        {loginLink && (
          <Link
            href="/login"
            style={{
              display: 'inline-block', padding: '10px 24px',
              borderRadius: 8, background: brand.gold, color: brand.darker,
              fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}
          >
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
}
