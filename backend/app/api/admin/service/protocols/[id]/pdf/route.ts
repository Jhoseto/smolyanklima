import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { ProtocolPDF } from "@/lib/protocol-pdf";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;

  let query = session.db
    .from("service_protocols")
    .select("*")
    .eq("id", id);

  if (session.role === "service_staff") {
    query = query.or(`created_by.eq.${session.userId},work_item_id.not.is.null`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data)  return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));

  const pdfBuffer = await renderToBuffer(
    React.createElement(ProtocolPDF, { data }) as Parameters<typeof renderToBuffer>[0]
  );

  const filename = `protokol-${data.protocol_number}.pdf`;
  const res = new NextResponse(new Blob([new Uint8Array(pdfBuffer)]), {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      String(pdfBuffer.byteLength),
    },
  });
  return withCors(req, res);
}
