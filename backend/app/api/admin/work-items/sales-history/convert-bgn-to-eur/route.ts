import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { applySalesBgnToEur, previewSalesBgnToEur } from "@/lib/admin/convertSalesBgnToEur";
import { BGN_PER_EUR, SALES_BGN_SALE_DATE_CUTOFF } from "@/lib/admin/currency";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const BodySchema = z.object({
  dryRun: z.boolean().optional().default(true),
});

/** POST — преглед или прилагане на BGN→EUR за исторически продажби (master_admin). */
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

  const json = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const supabase = await adminDb();
  const dryRun = parsed.data.dryRun !== false;

  try {
    if (dryRun) {
      const preview = await previewSalesBgnToEur(supabase);
      return withCors(
        req,
        NextResponse.json({
          data: {
            dryRun: true,
            ...preview,
          },
        }),
      );
    }

    const result = await applySalesBgnToEur(supabase);
    await logAdminActivity({
      action: "sales_history.convert_bgn_to_eur",
      entityType: "work_items",
      details: {
        cutoffDate: SALES_BGN_SALE_DATE_CUTOFF,
        rate: BGN_PER_EUR,
        ...result,
      },
    });

    return withCors(
      req,
      NextResponse.json({
        data: {
          dryRun: false,
          cutoffDate: SALES_BGN_SALE_DATE_CUTOFF,
          rate: BGN_PER_EUR,
          ...result,
        },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
