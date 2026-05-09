'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { brand } from '@/lib/ownerBrandTokens';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function OwnerShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isFranchisorPath = pathname?.startsWith('/owner/franchisor');
  const [role, setRole] = useState<'owner' | 'franchisor'>(
    isFranchisorPath ? 'franchisor' : 'owner'
  );

  const handleRoleChange = (newRole: 'owner' | 'franchisor') => {
    setRole(newRole);
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: brand.cream, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} role={role} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar role={role} onRoleChange={handleRoleChange} />
          <div style={{ flex: 1, overflowY: 'auto', background: brand.cream }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
