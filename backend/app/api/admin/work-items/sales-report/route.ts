import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { fetchSalesHistoryReport, SalesReportQuerySchema } from "@/lib/admin/fetchSalesHistoryReport";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** GET /api/admin/work-items/sales-report — агрегирана статистика (само master_admin) */
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
  const parsed = SalesReportQuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  try {
    const supabase = await adminDb();
    const report = await fetchSalesHistoryReport(supabase, parsed.data);
    return withCors(req, NextResponse.json({ data: report }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
