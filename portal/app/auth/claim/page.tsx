import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { ClaimContent } from './ClaimContent';
import { ClaimError } from './ClaimError';
import crypto from 'crypto';
import type { ReactNode } from 'react';

export const metadata = { title: 'Accept Invitation — Ballpark' };

interface SearchParams {
  token?: string;
}

/**
 * /auth/claim?token=<raw_hex_token>
 *
 * Server component: hashes the token, looks up hq_invites, validates,
 * then renders either the claim form (with read-only email) or an error state.
 * The actual write (create user, mark claimed) happens in /api/auth/claim.
 */
export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await searchParams;

  if (!token) notFound();

  const computedHash = crypto.createHash('sha256').update(token).digest('hex');
  const serviceClient = createServiceClient();

  const { data: invite } = await serviceClient
    .from('hq_invites')
    .select('id, email, status, expires_at')
    .eq('token_hash', computedHash)
    .maybeSingle();

  if (!invite) {
    return <ClaimError message="This invitation link is invalid or has already been used." />;
  }

  if (invite.status !== 'pending') {
    const msg =
      invite.status === 'claimed'
        ? 'This invitation has already been claimed. Please sign in.'
        : invite.status === 'revoked'
          ? 'This invitation has been revoked. Please contact your admin.'
          : 'This invitation is no longer valid.';
    return <ClaimError message={msg} loginLink={invite.status === 'claimed'} />;
  }

  if (new Date(invite.expires_at) < new Date()) {
    return <ClaimError message="This invitation has expired. Please ask for a new invite." />;
  }

  return <ClaimContent email={invite.email} token={token} />;
}
