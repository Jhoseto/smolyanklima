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

const PdfMetaSchema = {
  sectionLabel: z.string().max(200).optional(),
  filtersHint: z.string().max(600).optional(),
  generatedAt: z.string().max(80).optional(),
  aiAnalysis: z.string().max(120_000).optional(),
  aiAnalysisGeneratedAt: z.string().max(80).optional(),
};

const PdfQuerySchema = SalesReportQuerySchema.extend(PdfMetaSchema);
const PdfBodySchema = SalesReportQuerySchema.extend(PdfMetaSchema);

async function renderSalesReportPdfResponse(
  req: NextRequest,
  input: z.infer<typeof PdfQuerySchema>,
): Promise<NextResponse> {
  const { sectionLabel, filtersHint, generatedAt, aiAnalysis, aiAnalysisGeneratedAt, ...reportQuery } = input;

  const supabase = await adminDb();
  const report = await fetchSalesHistoryReport(supabase, reportQuery);

  const pdfBuffer = await renderToBuffer(
    React.createElement(SalesHistoryReportPDF, {
      report,
      sectionLabel: sectionLabel?.trim() || "История на продажби",
      filtersHint: filtersHint?.trim() || "Без допълнителни филтри",
      generatedAt: generatedAt?.trim() || undefined,
      aiAnalysis: aiAnalysis?.trim() || undefined,
      aiAnalysisGeneratedAt: aiAnalysisGeneratedAt?.trim() || undefined,
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
}

async function authorizePdf(req: NextRequest) {
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

  return null;
}

/** GET /api/admin/work-items/sales-report/pdf — PDF експорт (без AI текст) */
export async function GET(req: NextRequest) {
  const authErr = await authorizePdf(req);
  if (authErr) return authErr;

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = PdfQuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  try {
    return await renderSalesReportPdfResponse(req, parsed.data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}

/** POST /api/admin/work-items/sales-report/pdf — PDF с опционален AI анализ */
export async function POST(req: NextRequest) {
  const authErr = await authorizePdf(req);
  if (authErr) return authErr;

  const json = await req.json().catch(() => null);
  const parsed = PdfBodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  try {
    return await renderSalesReportPdfResponse(req, parsed.data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
