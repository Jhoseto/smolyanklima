import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { assertRepairProtocolVisible } from "@/lib/admin/repairProtocolAccess";
import { RepairProtocolPDF } from "@/lib/repair-protocol-pdf";

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

  const { data, error } = await session.db
    .from("service_repair_protocols")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const access = assertRepairProtocolVisible(session, data);
  if (!access.ok) {
    return withCors(req, NextResponse.json({ error: access.error }, { status: access.status }));
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(RepairProtocolPDF, { data }) as Parameters<typeof renderToBuffer>[0]
  );

  const protocolNumber = String(data.protocol_number ?? id);
  const status = data.status;
  const prefix = status === "signed" ? "servizen-protokol" : "chernova-servizen-protokol";
  const safeNumber = protocolNumber.replace(/[^\w.-]+/g, "_");
  const filename = `${prefix}-${safeNumber}.pdf`;

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
