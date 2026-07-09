import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { readAppRole, readTenantId } from '@/lib/auth';
import { getTenantName } from '@/lib/supabase/ownerQueries';
import { buildEmailSender, sendResendEmail } from '@/lib/email';

type Body = {
  eftTotal: number;
  otcTotal: number;
  transactionCount: number;
  startDate: string;
  endDate: string;
};

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtK(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return fmt(n);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const role = readAppRole(session);
  if (role !== 'owner' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json() as Partial<Body>;
  const { eftTotal = 0, otcTotal = 0, transactionCount = 0, startDate = '', endDate = '' } = body;

  const tenantId = readTenantId(session) ?? '';
  const tenantName = await getTenantName(supabase, tenantId);
  const ownerEmail = session.user.email ?? '';

  if (!ownerEmail) {
    return NextResponse.json({ error: 'No email address on your account' }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;

  if (!resendKey) {
    console.warn('[send-revenue-report] RESEND_API_KEY not configured — skipping email');
    return NextResponse.json({ skipped: true });
  }

  const totalRevenue = eftTotal + otcTotal;
  const eftPct = totalRevenue > 0 ? Math.round((eftTotal / totalRevenue) * 100) : 0;
  const otcPct = 100 - eftPct;

  const dateLabel = startDate && endDate ? `${startDate} – ${endDate}` : 'Last 12 Months';
  const subject = `Revenue Report — ${tenantName} — ${dateLabel}`;

  const html = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#2D2B2A;background:#ffffff">
      <div style="background:#2D2B2A;padding:24px 32px;text-align:center">
        <span style="color:#F1E5AD;font-size:22px;font-weight:800;letter-spacing:-0.5px">&#9971; ${tenantName}</span>
        <div style="color:#C9AC4B;font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase">Revenue Report</div>
      </div>

      <div style="padding:32px">
        <p style="margin:0 0 4px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600">Period</p>
        <p style="margin:0 0 28px;font-size:15px;font-weight:700">${dateLabel}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
          <tr>
            <td style="width:33%;padding:20px;background:#F6F9F6;border-radius:8px;text-align:center;vertical-align:top">
              <div style="font-size:11px;color:#16a34a;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Total Revenue</div>
              <div style="font-size:28px;font-weight:800;color:#2D2B2A;line-height:1">${fmtK(totalRevenue)}</div>
            </td>
            <td style="width:4px"></td>
            <td style="width:33%;padding:20px;background:#F0F7F0;border-radius:8px;text-align:center;vertical-align:top">
              <div style="font-size:11px;color:#16a34a;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">EFT · Recurring</div>
              <div style="font-size:28px;font-weight:800;color:#2D2B2A;line-height:1">${fmtK(eftTotal)}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">${eftPct}% of total</div>
            </td>
            <td style="width:4px"></td>
            <td style="width:33%;padding:20px;background:#FFFBEB;border-radius:8px;text-align:center;vertical-align:top">
              <div style="font-size:11px;color:#d97706;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">OTC · Upfront</div>
              <div style="font-size:28px;font-weight:800;color:#2D2B2A;line-height:1">${fmtK(otcTotal)}</div>
              <div style="font-size:12px;color:#888;margin-top:4px">${otcPct}% of total</div>
            </td>
          </tr>
        </table>

        <div style="background:#F6F4F1;border-radius:8px;padding:16px 20px;margin-bottom:28px">
          <span style="font-size:13px;color:#555">
            <strong>${transactionCount}</strong> payment transaction${transactionCount !== 1 ? 's' : ''} recorded in this period.
          </span>
        </div>

        <p style="font-size:13px;color:#888;margin:0">
          This report was generated on request from the Ballpark owner portal. Log in to view the full Revenue Reports page, filter by date, and export transactions as CSV.
        </p>
      </div>

      <div style="background:#F6F4F1;padding:16px;text-align:center;font-size:12px;color:#888">
        ${tenantName} &middot; Powered by Ballpark
      </div>
    </div>
  `;

  const sender = buildEmailSender({ businessName: tenantName });
  const result = await sendResendEmail({ to: ownerEmail, subject, text: subject, html, ...sender });

  if (!result.ok) {
    return NextResponse.json({ error: `Email delivery failed: ${result.error}` }, { status: 502 });
  }

  return NextResponse.json({ success: true, sentTo: ownerEmail });
}
