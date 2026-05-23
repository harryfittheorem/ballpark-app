import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') return null;
  return user;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await assertSuperAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing location id' }, { status: 400 });

  const body = await req.json() as {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    email?: string;
    timezone?: string;
    isActive?: boolean;
  };

  const service = createServiceClient();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined)     updates.name     = body.name;
  if (body.address !== undefined)  updates.address  = body.address || null;
  if (body.city !== undefined)     updates.city     = body.city || null;
  if (body.state !== undefined)    updates.state    = body.state || null;
  if (body.zip !== undefined)      updates.zip      = body.zip || null;
  if (body.phone !== undefined)    updates.phone    = body.phone || null;
  if (body.email !== undefined)    updates.email    = body.email || null;
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.isActive !== undefined) updates.is_active = body.isActive;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { error } = await service
    .from('locations')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
