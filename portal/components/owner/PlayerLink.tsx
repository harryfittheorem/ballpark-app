'use client';

import Link from 'next/link';
import { playerHref, type PlayerReference } from '@/lib/playerLinks';

export function PlayerLink({ name, reference, section }: {
  name: string;
  reference: PlayerReference;
  section?: 'payment-history' | 'package-history';
}) {
  const href = playerHref(reference, section);
  return href ? (
    <Link href={href} onClick={e => e.stopPropagation()} style={{ color: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
      {name}
    </Link>
  ) : (
    <span>{name}<small style={{ display: 'block', fontWeight: 400 }}>Profile unavailable — no verified player link</small></span>
  );
}
