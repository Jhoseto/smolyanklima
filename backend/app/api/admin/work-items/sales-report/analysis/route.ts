import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { generateSalesReportAiAnalysis } from "@/lib/admin/salesReportAiAnalysis";
import type { SalesHistoryReport } from "@/lib/admin/computeSalesHistoryReport";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const BodySchema = z.object({
  report: z.custom<SalesHistoryReport>(),
  sectionLabel: z.string().max(200).optional(),
  filtersHint: z.string().max(600).optional(),
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
});

/** POST /api/admin/work-items/sales-report/analysis — AI текстов анализ на отчета */
export async function POST(req: NextRequest) {
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

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const { report, sectionLabel, filtersHint, dateFrom, dateTo } = parsed.data;
  if (!report?.summary || report.summary.saleCount === 0) {
    return withCors(req, NextResponse.json({ error: "Няма продажби за анализ в отчета." }, { status: 400 }));
  }

  try {
    const result = await generateSalesReportAiAnalysis({
      report,
      sectionLabel,
      filtersHint,
      dateFrom,
      dateTo,
    });

    await logAdminActivity({
      action: "sales_report.ai_analysis",
      entityType: "sales_report",
      details: {
        sectionLabel: sectionLabel ?? null,
        filtersHint: filtersHint ?? null,
        saleCount: report.summary.saleCount,
        usage: result.usage,
      },
    });

    return withCors(req, NextResponse.json({ data: { text: result.text, usage: result.usage } }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "AI_DISABLED") {
      return withCors(req, NextResponse.json({ error: "AI функционалността е изключена." }, { status: 503 }));
    }
    if (msg === "AI_MISCONFIGURED") {
      return withCors(req, NextResponse.json({ error: "AI не е конфигуриран (липсва API ключ)." }, { status: 503 }));
    }
    if (msg === "AI_ANALYSIS_TOO_SHORT") {
      return withCors(req, NextResponse.json({ error: "AI върна твърде кратък текст. Опитайте „Прегенерирай анализ“." }, { status: 502 }));
    }
    if (msg === "AI_EMPTY_RESPONSE") {
      return withCors(req, NextResponse.json({ error: "AI не върна текст. Опитайте отново." }, { status: 502 }));
    }
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
