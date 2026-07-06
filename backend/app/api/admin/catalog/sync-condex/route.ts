import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runCondexCatalogSync, type CondexSyncProgressEvent } from "@/lib/import/condex/syncCondexCatalog";
import { createSseResponse } from "@/lib/http/sseStream";

export const maxDuration = 300;

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("product_catalog_settings")
    .select("condex_last_sync_at,condex_last_sync_status,condex_last_sync_summary,updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  return withCors(req, NextResponse.json({ data: data ?? null }));
}

async function authorizeSync(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return { error: withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })) };
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return {
      error: withCors(req, NextResponse.json({ error: "Само офис персонал може да синхронизира каталога." }, { status: 403 })),
    };
  }
  return { session };
}

export async function POST(req: NextRequest) {
  const auth = await authorizeSync(req);
  if ("error" in auth && auth.error) return auth.error;

  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(2000, Math.max(1, Number(limitParam) || 0)) : undefined;
  const stream = req.nextUrl.searchParams.get("stream") === "1";

  const supabase = createSupabaseAdminClient();

  if (stream) {
    return createSseResponse(async (send) => {
      try {
        const summary = await runCondexCatalogSync(supabase, {
          limit,
          onProgress: (ev: CondexSyncProgressEvent) => send("progress", ev),
        });

        await logAdminActivity({
          action: "catalog.condex_sync",
          entityType: "product_catalog_settings",
          entityId: null,
          details: summary,
        });

        send("done", { data: summary });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        await supabase.from("product_catalog_settings").upsert(
          {
            id: 1,
            condex_last_sync_status: "error",
            condex_last_sync_summary: { error: message },
          },
          { onConflict: "id" },
        );
        send("error", { error: message });
      }
    });
  }

  try {
    const summary = await runCondexCatalogSync(supabase, { limit });

    await logAdminActivity({
      action: "catalog.condex_sync",
      entityType: "product_catalog_settings",
      entityId: null,
      details: summary,
    });

    return withCors(req, NextResponse.json({ data: summary }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("product_catalog_settings").upsert(
      {
        id: 1,
        condex_last_sync_status: "error",
        condex_last_sync_summary: { error: message },
      },
      { onConflict: "id" },
    );
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
