'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';

type CheckInRpc = 'check_in_booking' | 'mark_no_show' | 'undo_check_in';

export type CheckInRpcResult =
  | { ok: true; data: { id: string; status: string; attended_at: string | null; cage_number: string | null } }
  | { ok: false; message: string };

async function resolvedRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  let role = readAppRole(session);
  if (role === 'parent' && user.app_metadata?.app_role) {
    role = user.app_metadata.app_role as typeof role;
  }
  if (role === 'parent' && user.user_metadata?.app_role) {
    role = user.user_metadata.app_role as typeof role;
  }
  return role;
}

async function callCheckInRpc(rpc: CheckInRpc, bookingId: string): Promise<CheckInRpcResult> {
  const role = await resolvedRole();
  if (!role || (role !== 'admin' && role !== 'owner' && role !== 'super_admin' && role !== 'coach')) {
    return { ok: false, message: 'Not authorised.' };
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc(rpc, { p_booking_id: bookingId });

  if (error) {
    const msg = (error.message ?? '').includes('UNDO_WINDOW_EXPIRED')
      ? 'Undo window has expired (5 minutes).'
      : error.message || 'Something went wrong.';
    return { ok: false, message: msg };
  }

  return { ok: true, data: data as { id: string; status: string; attended_at: string | null; cage_number: string | null } };
}

export async function checkInBookingAction(bookingId: string): Promise<CheckInRpcResult> {
  return callCheckInRpc('check_in_booking', bookingId);
}

export async function markNoShowAction(bookingId: string): Promise<CheckInRpcResult> {
  return callCheckInRpc('mark_no_show', bookingId);
}

export async function undoCheckInAction(bookingId: string): Promise<CheckInRpcResult> {
  return callCheckInRpc('undo_check_in', bookingId);
}
