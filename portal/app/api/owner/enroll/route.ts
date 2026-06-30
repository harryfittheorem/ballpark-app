/**
 * POST /api/owner/enroll
 *
 * Staff-led enrollment endpoint. Creates auth user + families + kids + family_waivers
 * + memberships in a single transaction-like sequence using the Supabase Admin API.
 *
 * Body: {
 *   parent_first_name: string,
 *   parent_last_name: string,
 *   parent_email: string,
 *   parent_phone?: string,
 *   kid_first_name: string,
 *   kid_last_name?: string,
 *   age_group?: string,
 *   plan_id: string,
 *   waiver_id: string,
 *   signature_image_data: string,  -- base64 data URL (data:image/png;base64,...)
 * }
 *
 * Returns: { ok: true, family_id, kid_id, membership_id }
 */
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole, readTenantId } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function err(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([a-zA-Z0-9+/]+\/[a-zA-Z0-9+/]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return err(401, 'Unauthorized');

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'admin') return err(403, 'Forbidden');

  const tenantId = readTenantId(session);
  if (!tenantId) return err(401, 'No tenant in session');

  let body: {
    parent_first_name?: string;
    parent_last_name?: string;
    parent_email?: string;
    parent_phone?: string;
    kid_first_name?: string;
    kid_last_name?: string;
    age_group?: string;
    plan_id?: string;
    waiver_id?: string;
    signature_image_data?: string;
  };
  try {
    body = await req.json() as typeof body;
  } catch {
    return err(400, 'Invalid JSON body');
  }

  const {
    parent_first_name, parent_last_name, parent_email, parent_phone,
    kid_first_name, kid_last_name, age_group,
    plan_id, waiver_id, signature_image_data,
  } = body;

  if (!parent_first_name) return err(422, 'parent_first_name required');
  if (!parent_last_name) return err(422, 'parent_last_name required');
  if (!parent_email) return err(422, 'parent_email required');
  if (!kid_first_name) return err(422, 'kid_first_name required');
  if (!plan_id) return err(422, 'plan_id required');
  if (!waiver_id) return err(422, 'waiver_id required');
  if (!signature_image_data) return err(422, 'signature_image_data required');

  const serviceClient = createServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // ── 1. Load tenant slug (required by handle_new_user trigger) + verify plan ─
  const [{ data: tenant }, { data: plan, error: planErr }] = await Promise.all([
    serviceClient
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single(),
    serviceClient
      .from('membership_plans')
      .select('id, name, plan_type, amount_cents, sessions_per_week')
      .eq('id', plan_id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single(),
  ]);

  const tenantSlug = (tenant as { slug: string } | null)?.slug;
  if (!tenantSlug) return err(500, 'Could not load tenant configuration');
  if (planErr || !plan) return err(404, 'Plan not found or inactive');

  // ── 2. Verify waiver belongs to this tenant ────────────────────────────────
  const { data: waiver, error: waiverErr } = await serviceClient
    .from('waivers')
    .select('id, tenant_id')
    .eq('id', waiver_id)
    .eq('tenant_id', tenantId)
    .single();

  if (waiverErr || !waiver) return err(404, 'Waiver not found');

  // ── 3. Check for duplicate email ───────────────────────────────────────────
  const listRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(parent_email)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const listBody = await listRes.json() as { users?: Array<{ email: string; id: string }> };
  const existing = (listBody.users ?? []).find((u) => u.email?.toLowerCase() === parent_email.toLowerCase());
  if (existing) {
    return err(409, `An account with email ${parent_email} already exists. Use the invite flow to add them.`);
  }

  // ── 4. Create auth user (email_confirm: true so they can sign in immediately) ─
  const tempPassword = crypto.getRandomValues(new Uint8Array(16))
    .reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');

  const createUserRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email: parent_email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        app_role: 'parent',
        tenant_slug: tenantSlug,
        first_name: parent_first_name,
        last_name: parent_last_name,
      },
    }),
  });

  if (!createUserRes.ok) {
    const createErr = await createUserRes.json().catch(() => ({})) as { msg?: string; message?: string };
    return err(502, createErr.msg ?? createErr.message ?? 'Failed to create user account');
  }
  const createdUser = await createUserRes.json() as { id: string };
  const userId = createdUser.id;

  try {
    // ── 5. The handle_new_user trigger creates the families row.
    //       Poll briefly for it to appear, then update with our fields.
    let familyId: string | null = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      const { data: fam } = await serviceClient
        .from('families')
        .select('id')
        .eq('parent_user_id', userId)
        .maybeSingle();
      if (fam?.id) { familyId = fam.id; break; }
    }

    if (!familyId) {
      // Trigger may not have fired — insert manually
      const { data: newFam, error: famInsertErr } = await serviceClient
        .from('families')
        .insert({
          parent_user_id: userId,
          tenant_id: tenantId,
          parent_first_name,
          parent_last_name,
          parent_email,
          parent_phone: parent_phone ?? null,
        })
        .select('id')
        .single();

      if (famInsertErr || !newFam) {
        throw new Error(`Failed to create family: ${famInsertErr?.message ?? 'unknown'}`);
      }
      familyId = newFam.id;
    } else {
      // Update the trigger-created row with full details
      await serviceClient
        .from('families')
        .update({
          parent_first_name,
          parent_last_name,
          parent_email,
          parent_phone: parent_phone ?? null,
          tenant_id: tenantId,
        })
        .eq('id', familyId);
    }

    // ── 6. Create kid row ──────────────────────────────────────────────────
    const { data: newKid, error: kidErr } = await serviceClient
      .from('kids')
      .insert({
        family_id: familyId,
        first_name: kid_first_name,
        last_name: kid_last_name ?? null,
        age_group: age_group ?? null,
      })
      .select('id')
      .single();

    if (kidErr || !newKid) {
      throw new Error(`Failed to create kid: ${kidErr?.message ?? 'unknown'}`);
    }
    const kidId = newKid.id;

    // ── 7. Upload signature to Supabase Storage (required) ───────────────
    const parsed = dataUrlToBuffer(signature_image_data);
    if (!parsed) {
      throw new Error('Invalid signature image data');
    }

    const storagePath = `${tenantId}/${familyId}/${waiver_id}.png`;
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/waiver-signatures/${storagePath}`,
      {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: new Uint8Array(parsed.buffer),
      },
    );
    if (!uploadRes.ok) {
      const uploadErr = await uploadRes.text();
      throw new Error(`Signature upload failed: ${uploadErr}`);
    }
    const signaturePath = storagePath;

    // ── 8. Insert family_waivers row — required for mobile waiver-skip ────
    const { error: waiverInsertErr } = await serviceClient
      .from('family_waivers')
      .insert({
        family_id: familyId,
        waiver_id,
        signature_image_path: signaturePath,
        app_version: 'portal-kiosk',
      });

    if (waiverInsertErr) {
      throw new Error(`Failed to record waiver signature: ${waiverInsertErr.message}`);
    }

    // ── 9. Create membership row ──────────────────────────────────────────
    const typedPlan = plan as { name: string; plan_type: string; amount_cents: number; sessions_per_week: number | null };
    const isEft = typedPlan.plan_type === 'eft';
    const currentMonday = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    })();

    const { data: newMembership, error: memErr } = await serviceClient
      .from('memberships')
      .insert({
        family_id: familyId,
        kid_id: kidId,
        tenant_id: tenantId,
        plan_name: typedPlan.name,
        plan_type: typedPlan.plan_type,
        status: 'pending',
        amount_cents: typedPlan.amount_cents,
        ...(isEft && typedPlan.sessions_per_week != null ? {
          sessions_per_week: typedPlan.sessions_per_week,
          weekly_period_start: currentMonday,
          weekly_sessions_used: 0,
        } : {}),
      })
      .select('id')
      .single();

    if (memErr || !newMembership) {
      throw new Error(`Failed to create membership: ${memErr?.message ?? 'unknown'}`);
    }
    const membershipId = newMembership.id;

    // Welcome email is sent from /api/owner/enroll/attach-payment after
    // payment succeeds and the membership is confirmed active.

    return NextResponse.json({
      ok: true,
      family_id: familyId,
      kid_id: kidId,
      membership_id: membershipId,
    });

  } catch (e) {
    // Clean up the created auth user to avoid orphaned accounts
    console.error('[enroll] rollback — deleting orphaned auth user:', userId, e);
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    }).catch(() => {});

    const msg = e instanceof Error ? e.message : 'Enrollment failed';
    return err(500, msg);
  }
}
