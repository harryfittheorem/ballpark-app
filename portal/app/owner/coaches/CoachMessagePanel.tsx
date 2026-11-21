'use client';

import { X } from 'lucide-react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import type { OwnerCoach } from '@/lib/supabase/ownerQueries';

type Props = { coach: OwnerCoach; tenantId: string; onClose: () => void };

export function CoachMessagePanel({ coach, onClose }: Props) {
  return (
    <>
      <button
        aria-label="Close messaging notice"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', border: 0, zIndex: 999 }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="messaging-policy-title"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 100%)',
          background: brand.surface, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${brand.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: brand.dark,
        }}>
          <div>
            <div id="messaging-policy-title" style={{ fontSize: 11, color: brand.goldDeep, fontWeight: 700, letterSpacing: 1, fontFamily: fonts.display, textTransform: 'uppercase' }}>Messaging unavailable</div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.gold, marginTop: 4 }}>{coach.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 0, cursor: 'pointer', color: brand.textLight, padding: 8 }}><X size={20} /></button>
        </header>
        <div style={{ padding: 24, color: brand.textMuted, fontSize: 14, lineHeight: 1.65 }}>
          Instructor-to-player messaging is unavailable. Adult messaging awaits approval. This panel does not send messages or upload videos.
        </div>
      </section>
    </>
  );
}
