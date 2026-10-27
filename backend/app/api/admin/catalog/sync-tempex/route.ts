import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { createSseResponse } from "@/lib/http/sseStream";
import { runTempexCatalogSync } from "@/lib/import/tempex/syncTempexCatalog";
import { readTempexSyncStatus, TempexSyncBusyError } from "@/lib/import/tempex/tempexSyncStatus";

export const maxDuration = 1800;

export async function OPTIONS(req: NextRequest) { return corsPreflight(req); }

async function authorize(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }
  try { requireRole(session, "master_admin", "office_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Само офис персонал може да синхронизира каталога." }, { status: 403 })); }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  try {
    return withCors(req, NextResponse.json({ data: await readTempexSyncStatus(createSupabaseAdminClient()) }));
  } catch (error) {
    return withCors(req, NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  const denied = await authorize(req);
  if (denied) return denied;
  const rawLimit = req.nextUrl.searchParams.get("limit");
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 2000)) {
    return withCors(req, NextResponse.json({ error: "Лимитът трябва да е цяло число между 1 и 2000." }, { status: 400 }));
  }
  const db = createSupabaseAdminClient();
  const audit = async (summary: Awaited<ReturnType<typeof runTempexCatalogSync>>) => {
    await logAdminActivity({ action: "catalog.tempex_sync", entityType: "product_catalog_settings", entityId: null, details: summary });
  };
  if (req.nextUrl.searchParams.get("stream") === "1") {
    return createSseResponse(async (send) => {
      try {
        const summary = await runTempexCatalogSync(db, { limit, onProgress: (event) => send("progress", event) });
        await audit(summary);
        send("done", { data: summary });
      } catch (error) {
        send("error", { error: error instanceof Error ? error.message : String(error) });
      }
    });
  }
  try {
    const summary = await runTempexCatalogSync(db, { limit });
    await audit(summary);
    return withCors(req, NextResponse.json({ data: summary }));
  } catch (error) {
    return withCors(req, NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: error instanceof TempexSyncBusyError ? 409 : 500 }));
  }
}
