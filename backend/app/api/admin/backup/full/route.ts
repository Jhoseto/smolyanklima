import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

export const maxDuration = 300;

const PAGE = 2000;

type RpcRow = { table_name: string };

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
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само главен администратор може да изтегля пълен архив." }, { status: 403 }));
  }

  const supabase = session.db;
  const { data: tableRows, error: rpcErr } = await supabase.rpc("admin_export_list_public_tables");
  if (rpcErr) {
    return withCors(req, NextResponse.json({ error: rpcErr.message }, { status: 500 }));
  }

  const names = ((tableRows ?? []) as RpcRow[]).map((r) => r.table_name).filter(Boolean);
  const exportedAt = new Date().toISOString();
  const data: Record<string, unknown[]> = {};
  const tableErrors: Record<string, string> = {};

  for (const table of names) {
    const rows: unknown[] = [];
    let offset = 0;
    let errMsg: string | null = null;
    for (;;) {
      const { data: chunk, error } = await supabase.from(table).select("*").range(offset, offset + PAGE - 1);
      if (error) {
        errMsg = error.message;
        break;
      }
      const part = chunk ?? [];
      rows.push(...part);
      if (part.length < PAGE) break;
      offset += PAGE;
    }
    if (errMsg) tableErrors[table] = errMsg;
    else data[table] = rows as unknown[];
  }

  const body = {
    manifest: {
      format: "smolyanklima-full-json",
      formatVersion: 1,
      exportedAt,
      tables: names,
      rowCounts: Object.fromEntries(names.map((t) => [t, Array.isArray(data[t]) ? (data[t] as unknown[]).length : 0])),
      tableErrors: Object.keys(tableErrors).length ? tableErrors : undefined,
    },
    data,
  };

  const filename = `smolyanklima-backup-${exportedAt.replace(/[:]/g, "-")}.json`;

  await logAdminActivity({
    action: "backup.full_export",
    entityType: "database",
    entityId: null,
    details: {
      tables: names.length,
      rowCounts: body.manifest.rowCounts,
      hadErrors: Object.keys(tableErrors).length > 0,
    },
  });

  return withCors(
    req,
    new NextResponse(JSON.stringify(body), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    }),
  );
}
