import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/serviceClient';
import { readAppRole } from '@/lib/auth';
import { buildEmailSender, sendResendEmail } from '@/lib/email';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  const { data: { session } } = await supabase.auth.getSession();
  if (readAppRole(session) !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as {
    email: string;
    firstName: string;
    lastName: string;
    role: 'coach' | 'admin' | 'owner';
    tenantSlug: string;
    locationId?: string;
  };

  const { email, firstName, lastName, role, tenantSlug, locationId } = body;

  if (!email || !firstName || !lastName || !role || !tenantSlug) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenants')
    .select('id, name')
    .eq('slug', tenantSlug)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: `Tenant slug "${tenantSlug}" not found` }, { status: 400 });
  }

  // Validate locationId belongs to this tenant if provided.
  if (locationId) {
    const { data: loc } = await serviceClient
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('tenant_id', tenant.id)
      .single();
    if (!loc) {
      return NextResponse.json({ error: 'Location not found for this franchise' }, { status: 400 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const listRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  const listBody = await listRes.json() as { users?: Array<{ email: string; id: string }> };
  const existing = (listBody.users ?? []).find((u) => u.email === email);
  if (existing) {
    return NextResponse.json({ error: `A user with email ${email} already exists.` }, { status: 409 });
  }

  const userMeta = {
    app_role: role,
    tenant_slug: tenantSlug,
    first_name: firstName,
    last_name: lastName,
  };

  const resendKey = process.env.RESEND_API_KEY;

  let createdUserId: string | null = null;

  if (resendKey) {
    // Generate a magic link and deliver it ourselves via Resend.
    // generate_link with type=invite creates the user immediately.
    const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        type: 'invite',
        email,
        data: userMeta,
        redirect_to: `${
          process.env.NODE_ENV !== 'production'
            ? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000')
            : (process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/$/, '') ?? 'http://localhost:5000')
        }/auth/accept-invite`,
      }),
    });
    const linkBody = await linkRes.json() as {
      action_link?: string;
      hashed_token?: string;
      verification_type?: string;
      id?: string;
      error?: string;
      msg?: string;
    };

    console.log('[hq/invite] generate_link response keys:', Object.keys(linkBody));
    console.log('[hq/invite] action_link:', linkBody.action_link);
    console.log('[hq/invite] hashed_token present:', !!linkBody.hashed_token);
    console.log('[hq/invite] REPLIT_DEV_DOMAIN:', process.env.REPLIT_DEV_DOMAIN);
    console.log('[hq/invite] NODE_ENV:', process.env.NODE_ENV);

    if (!linkRes.ok || (!linkBody.action_link && !linkBody.hashed_token)) {
      const errMsg = linkBody.error ?? linkBody.msg ?? 'Failed to generate invite link';
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    createdUserId = linkBody.id ?? null;

    // Build the portal callback origin (dev uses Replit dev domain, prod uses NEXT_PUBLIC_PORTAL_URL).
    const portalOrigin =
      process.env.NODE_ENV !== 'production'
        ? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000')
        : (process.env.NEXT_PUBLIC_PORTAL_URL?.replace(/\/$/, '') ?? 'http://localhost:5000');
    const redirectTo = `${portalOrigin}/auth/accept-invite`;

    // Build a clean /auth/v1/verify URL using hashed_token.
    // This avoids two issues with action_link:
    //   1. action_link origin may be "localhost" (Supabase Site URL misconfigured)
    //   2. Implicit-flow action_links contain tokens in the URL hash which many
    //      email clients strip, breaking the link entirely.
    // The verify endpoint always receives the token as a query param (not hash),
    // survives email delivery, and lets Supabase redirect to our portal page
    // with the session in the hash — where the browser (not the email client) handles it.
    let inviteLink: string;
    if (linkBody.hashed_token) {
      const params = new URLSearchParams({
        token: linkBody.hashed_token,
        type: 'invite',
        redirect_to: redirectTo,
      });
      inviteLink = `${new URL(supabaseUrl).origin}/auth/v1/verify?${params.toString()}`;
    } else {
      // Fallback: fix action_link origin if it points at localhost.
      inviteLink = linkBody.action_link ?? '';
      try {
        const parsed = new URL(inviteLink);
        if (parsed.hostname === 'localhost') {
          if (parsed.pathname.startsWith('/auth/v1/')) {
            inviteLink = new URL(supabaseUrl).origin + parsed.pathname + parsed.search + parsed.hash;
          } else {
            inviteLink = redirectTo + parsed.hash;
          }
        }
      } catch { /* leave as-is */ }
    }

    console.log('[hq/invite] final inviteLink:', inviteLink);

    const roleLabel = role === 'coach' ? 'Coach' : role === 'admin' ? 'Admin' : 'Owner';
    const inviteSubject = `You've been invited to Ballpark — ${tenant.name}`;
    const inviteHtml = `
          <p>Hi ${firstName},</p>
          <p>You've been invited to join <strong>${tenant.name}</strong> on Ballpark as a <strong>${roleLabel}</strong>.</p>
          <p>Click the link below to set your password and activate your account:</p>
          <p><a href="${inviteLink}" style="background:#F1E5AD;color:#2D2B2A;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Accept Invitation</a></p>
          <p>This link expires in 24 hours.</p>
          <p>— The Ballpark Team</p>
        `;
    const sender = buildEmailSender({ businessName: tenant.name });
    const sendResult = await sendResendEmail({
      to: email,
      subject: inviteSubject,
      text: inviteSubject,
      html: inviteHtml,
      ...sender,
    });

    if (!sendResult.ok) {
      // Roll back: delete the auth user so the same email can be re-invited cleanly.
      if (createdUserId) {
        await fetch(`${supabaseUrl}/auth/v1/admin/users/${createdUserId}`, {
          method: 'DELETE',
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        }).catch(() => { /* best-effort cleanup */ });
      }
      return NextResponse.json({ error: `Email delivery failed: ${sendResult.error}` }, { status: 502 });
    }
  } else {
    // No Resend configured — use Supabase's built-in invite email (sends automatically).
    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        email_confirm: false,
        invite: true,
        user_metadata: userMeta,
      }),
    });

    if (!inviteRes.ok) {
      const inviteErr = await inviteRes.json().catch(() => ({})) as { msg?: string; message?: string; id?: string };
      return NextResponse.json(
        { error: inviteErr.msg ?? inviteErr.message ?? 'Failed to create invite' },
        { status: 502 },
      );
    }

    const inviteBody = await inviteRes.json().catch(() => ({})) as { id?: string };
    createdUserId = inviteBody.id ?? null;
  }

  // If a location was specified and role is coach, wire up primary_location_id.
  // The handle_new_user trigger fires synchronously, so the coaches row exists.
  if (locationId && role === 'coach' && createdUserId) {
    await serviceClient
      .from('coaches')
      .update({ primary_location_id: locationId })
      .eq('user_id', createdUserId);
  }

  return NextResponse.json({ success: true, email, tenantName: tenant.name });
}
