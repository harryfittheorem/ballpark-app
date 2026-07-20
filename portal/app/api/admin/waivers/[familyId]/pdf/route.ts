/**
 * GET /api/admin/waivers/[familyId]/pdf
 *
 * Admin-only route that generates a signed-agreement PDF on the fly using
 * pdf-lib. No Supabase Storage required — the PDF is rendered from the
 * stored body_text + family_waivers metadata and streamed directly to the
 * browser.
 */
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

import { readAppRole, readTenantId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/serviceClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ familyId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const role = readAppRole(session);
  if (role !== "admin" && role !== "owner" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = readTenantId(session);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const { familyId } = await params;
  const svc = createServiceClient();

  type FamilyWaiverRow = {
    id: string;
    signed_at: string;
    app_version: string | null;
    ip_address: string | null;
    waiver: { body_text: string; version: number; effective_date: string } | null;
    family: {
      parent_first_name: string;
      parent_last_name: string | null;
      parent_email: string;
      tenant_id: string;
    } | null;
  };

  const { data: fw } = await svc
    .from("family_waivers")
    .select(
      `id, signed_at, app_version, ip_address,
       waiver:waiver_id(body_text, version, effective_date),
       family:family_id(parent_first_name, parent_last_name, parent_email, tenant_id)`,
    )
    .eq("family_id", familyId)
    .order("signed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fw) {
    return NextResponse.json(
      { error: "No signed waiver found for this family." },
      { status: 404 },
    );
  }

  const fwTyped = fw as unknown as FamilyWaiverRow;
  const family = fwTyped.family;

  if (!family || family.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const waiver = fwTyped.waiver;
  if (!waiver) {
    return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
  }

  const { data: kids } = await svc
    .from("kids")
    .select("first_name, last_name")
    .eq("family_id", familyId)
    .limit(10);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 60;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const LINE_H = 14;
  const BODY_SIZE = 9.5;

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 20) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function wrapText(text: string, maxW: number, size: number): string[] {
    const paragraphs = text.split("\n");
    const result: string[] = [];
    for (const para of paragraphs) {
      if (para.trim() === "") {
        result.push("");
        continue;
      }
      const words = para.split(" ");
      let current = "";
      for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) > maxW && current) {
          result.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) result.push(current);
    }
    return result;
  }

  function drawLine(text: string, size: number, useBold: boolean, indent = 0, color: [number, number, number] = [0.1, 0.1, 0.1]) {
    ensureSpace(LINE_H + 4);
    page.drawText(text, {
      x: MARGIN + indent,
      y,
      size,
      font: useBold ? boldFont : font,
      color: rgb(color[0], color[1], color[2]),
    });
    y -= LINE_H;
  }

  function drawParagraph(text: string, size: number, useBold: boolean, indent = 0, color: [number, number, number] = [0.1, 0.1, 0.1]) {
    const lines = wrapText(text, CONTENT_W - indent, size);
    for (const line of lines) {
      if (line === "") {
        y -= LINE_H * 0.5;
      } else {
        drawLine(line, size, useBold, indent, color);
      }
    }
  }

  function hr(thickness = 0.5, color: [number, number, number] = [0.8, 0.8, 0.8]) {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness,
      color: rgb(color[0], color[1], color[2]),
    });
    y -= 14;
  }

  function spacer(h = 10) { y -= h; }

  const parentName = `${family.parent_first_name} ${family.parent_last_name ?? ""}`.trim();
  const kidNames =
    (kids ?? [])
      .map((k) => `${k.first_name}${k.last_name ? ` ${k.last_name}` : ""}`)
      .join(", ") || "—";

  const signedAt = new Date(fwTyped.signed_at);
  const signedDateStr = signedAt.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  drawLine("SIGNED MEMBERSHIP AGREEMENT", 15, true);
  spacer(4);
  hr(1, [0.2, 0.2, 0.2]);

  drawLine("SIGNATURE RECORD", BODY_SIZE - 0.5, true, 0, [0.45, 0.45, 0.45]);
  spacer(4);

  const sigRows: [string, string][] = [
    ["Signed by (parent / guardian)", parentName],
    ["On behalf of (athlete)", kidNames],
    ["Email", family.parent_email],
    ["Date & time signed", signedDateStr],
    ["IP address", fwTyped.ip_address ?? "not recorded"],
    ["Agreement version", `v${waiver.version} (effective ${waiver.effective_date})`],
    ["App version", fwTyped.app_version ?? "web / portal"],
  ];

  for (const [label, value] of sigRows) {
    ensureSpace(LINE_H * 2 + 4);
    page.drawText(`${label}:`, {
      x: MARGIN,
      y,
      size: BODY_SIZE - 0.5,
      font: boldFont,
      color: rgb(0.35, 0.35, 0.35),
    });
    page.drawText(value, {
      x: MARGIN + 180,
      y,
      size: BODY_SIZE - 0.5,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= LINE_H;
  }

  spacer(12);
  hr();
  drawLine("AGREEMENT TEXT", BODY_SIZE - 0.5, true, 0, [0.45, 0.45, 0.45]);
  spacer(8);

  const bodyParagraphs = waiver.body_text.split("\n");
  for (const para of bodyParagraphs) {
    const trimmed = para.trim();
    if (trimmed === "") {
      spacer(6);
      continue;
    }
    const isHeader =
      /^\d+\.\s/.test(trimmed) ||
      (trimmed === trimmed.toUpperCase() && trimmed.length < 80);
    drawParagraph(trimmed, BODY_SIZE, isHeader);
  }

  spacer(20);
  hr(1, [0.2, 0.2, 0.2]);
  drawLine(
    `This document was generated on ${new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })} and reflects the signed agreement record stored in the Ballpark platform.`,
    BODY_SIZE - 1.5,
    false,
    0,
    [0.55, 0.55, 0.55],
  );

  const pdfBytes = await pdfDoc.save();

  const safeParent = parentName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const filename = `agreement-${safeParent}-v${waiver.version}.pdf`;

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
