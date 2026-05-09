import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { ProtocolPDF } from "@/lib/protocol-pdf";
import { sendResendEmail } from "@/lib/email/resend";
import { EMAIL_BRAND_LOGO_SVG } from "@/lib/brand-email";

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BodySchema = z.object({
  email: z.string().email("Невалиден имейл адрес"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));
  }

  const { id } = await params;

  let query = session.db
    .from("service_protocols")
    .select("*")
    .eq("id", id);

  if (session.role === "service_staff") {
    query = query.eq("created_by", session.userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data)  return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));

  // Генериране на PDF
  const pdfBuffer = await renderToBuffer(
    React.createElement(ProtocolPDF, { data }) as Parameters<typeof renderToBuffer>[0]
  );
  const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

  const clientName = escHtml(data.client_name ?? "клиент");
  const formattedDate = data.date
    ? new Date(data.date).toLocaleDateString("bg-BG")
    : "";
  const protoNo = escHtml(data.protocol_number);
  const safePdfName = `protokol-${data.protocol_number.replace(/[^\w.-]+/g, "_")}.pdf`;

  const result = await sendResendEmail({
    to:      parsed.data.email,
    from:    process.env.NOTIFY_EMAIL_FROM ?? "noreply@smolyanklima.com",
    subject: `Приемно-предавателен протокол № ${data.protocol_number}`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111827;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:22px;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;line-height:0;">${EMAIL_BRAND_LOGO_SVG}</td>
            <td style="vertical-align:middle;padding-left:10px;font-size:18px;font-weight:800;line-height:1.05;">
              <span style="color:#FF4D00;">СМОЛЯН</span><span style="color:#0077B6;">КЛИМА</span>
            </td>
          </tr>
        </table>
        <h2 style="margin:0 0 14px;font-size:18px;color:#0f172a;">Протокол за монтаж</h2>
        <p style="margin:0 0 12px;line-height:1.5;">Уважаеми <strong>${clientName}</strong>,</p>
        <p style="margin:0 0 12px;line-height:1.5;">
          Прилагаме приемно-предавателния протокол <strong>№ ${protoNo}</strong>
          от <strong>${escHtml(formattedDate)}</strong> за извършения монтаж на климатична система.
        </p>
        <p style="margin:0 0 12px;line-height:1.5;">
          PDF файлът е прикачен към този имейл. При въпроси се свържете с нас.
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="font-size:13px;color:#6b7280;margin:0;line-height:1.45;">
          Смолян Клима ЕООД · гр. Смолян, ул. Елица № 36 · Тел: 0888 58 58 16
        </p>
      </div>
    `,
    text:
      `Смолян Клима — Протокол № ${data.protocol_number} от ${formattedDate}. ` +
      `PDF е прикачен към имейла.`,
    attachments: [{ filename: safePdfName, content: pdfBase64 }],
  });

  if (result.ok === false && result.skipped !== true) {
    return withCors(req, NextResponse.json({ error: result.error }, { status: 502 }));
  }

  // Обнови статуса на протокола
  await session.db
    .from("service_protocols")
    .update({ status: "sent" })
    .eq("id", id);

  const skipped = result.ok ? false : Boolean(result.skipped);
  return withCors(req, NextResponse.json({ ok: true, skipped }));
}
