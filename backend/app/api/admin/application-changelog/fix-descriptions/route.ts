import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import {
  countFailedChangelog,
  countNeedsAiResummary,
  applyDetailedFallbackToGeneric,
  resummarizeGenericBatch,
  summarizeFailedBatch,
} from "@/lib/admin/applicationChangelog/ingestCommit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Upgrade descriptions: AI resummary for generic/heuristic rows; optional ?batch=N */
export async function POST(req: NextRequest) {
  try {
    const session = await adminSession();
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const batchSize = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("batch") || "5", 10), 1), 10);

  try {
    let upgraded = 0;

    const fallback = await applyDetailedFallbackToGeneric(150);
    upgraded += fallback.updated;

    const failed = await countFailedChangelog();
    if (failed > 0) {
      const result = await summarizeFailedBatch(Math.min(batchSize, failed));
      upgraded += result.succeeded;
    }

    const result = await resummarizeGenericBatch(batchSize);
    upgraded += result.upgraded;

    const remaining = await countNeedsAiResummary();
    const stillFailed = await countFailedChangelog();

    return withCors(
      req,
      NextResponse.json({
        ok: true,
        upgraded,
        remaining,
        stillFailed,
        done: remaining === 0 && stillFailed === 0,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fix failed";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
