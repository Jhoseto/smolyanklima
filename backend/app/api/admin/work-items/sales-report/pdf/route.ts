import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { fetchSalesHistoryReport, SalesReportQuerySchema } from "@/lib/admin/fetchSalesHistoryReport";
import { SalesHistoryReportPDF } from "@/lib/sales-history-report-pdf";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const PdfQuerySchema = SalesReportQuerySchema.extend({
  sectionLabel: z.string().max(200).optional(),
  filtersHint: z.string().max(600).optional(),
  generatedAt: z.string().max(80).optional(),
});

/** GET /api/admin/work-items/sales-report/pdf — PDF експорт на аналитичния отчет */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 }));
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = PdfQuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  const { sectionLabel, filtersHint, generatedAt, ...reportQuery } = parsed.data;

  try {
    const supabase = await adminDb();
    const report = await fetchSalesHistoryReport(supabase, reportQuery);

    const pdfBuffer = await renderToBuffer(
      React.createElement(SalesHistoryReportPDF, {
        report,
        sectionLabel: sectionLabel?.trim() || "История на продажби",
        filtersHint: filtersHint?.trim() || "Без допълнителни филтри",
        generatedAt: generatedAt?.trim() || undefined,
      }) as Parameters<typeof renderToBuffer>[0],
    );

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `otchet-prodazhbi-${stamp}.pdf`;
    const res = new NextResponse(new Blob([new Uint8Array(pdfBuffer)]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
    return withCors(req, res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
