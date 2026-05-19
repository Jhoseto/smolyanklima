import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { buildBusinessExcelBuffer } from "@/lib/backup/buildExcelBackup";
import { exportBusinessExcelData } from "@/lib/backup/exportBusinessExcelData";
import { backupFilename, exportAllPublicTables } from "@/lib/backup/exportPublicTables";

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
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само главен администратор може да изтегля пълен архив." }, { status: 403 }));
  }

  const format = req.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "json";
  const supabase = session.db;

  if (format === "xlsx") {
    try {
      const business = await exportBusinessExcelData(supabase);
      const buffer = buildBusinessExcelBuffer(business);
      const filename = backupFilename(business.exportedAt, "xlsx");

      await logAdminActivity({
        action: "backup.business_export_xlsx",
        entityType: "database",
        entityId: null,
        details: {
          sales: business.sales.length,
          stockInStock: business.stock.length,
        },
      });

      return withCors(
        req,
        new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.ms-excel; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        }),
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
    }
  }

  let exported;
  try {
    exported = await exportAllPublicTables(supabase);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }

  const { exportedAt, names, data, tableErrors } = exported;
  const rowCounts = Object.fromEntries(
    names.map((t) => [t, tableErrors[t] ? 0 : (data[t]?.length ?? 0)]),
  );
  const hadErrors = Object.keys(tableErrors).length > 0;

  await logAdminActivity({
    action: "backup.full_export",
    entityType: "database",
    entityId: null,
    details: { format: "json", tables: names.length, rowCounts, hadErrors },
  });

  const filename = backupFilename(exportedAt, "json");
  const body = {
    manifest: {
      format: "smolyanklima-full-json",
      formatVersion: 1,
      exportedAt,
      tables: names,
      rowCounts,
      tableErrors: hadErrors ? tableErrors : undefined,
    },
    data,
  };

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
