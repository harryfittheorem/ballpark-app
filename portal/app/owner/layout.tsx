import type { ReactNode } from 'react';
import { OwnerShell } from '@/components/owner/OwnerShell';

export const metadata = {
  title: 'Owner Portal — Ballpark',
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <OwnerShell>{children}</OwnerShell>;
}
