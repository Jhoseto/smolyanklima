import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  importPublicTablesBackup,
  parseBackupFile,
  REPLACE_RESTORE_DISABLED_MESSAGE,
} from "@/lib/backup/importPublicTablesBackup";

export const maxDuration = 300;

const bodySchema = z.object({
  backup: z.unknown(),
  mode: z.enum(["merge", "replace"]),
  confirm: z.literal("RESTORE"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

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
    return withCors(
      req,
      NextResponse.json({ error: "Само главен администратор може да възстановява архив." }, { status: 403 }),
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return withCors(req, NextResponse.json({ error: "Невалидно JSON тяло." }, { status: 400 }));
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      req,
      NextResponse.json(
        { error: "Посочете mode (merge/replace) и confirm: RESTORE за потвърждение." },
        { status: 400 },
      ),
    );
  }
  if (parsed.data.mode === "replace") {
    return withCors(req, NextResponse.json({ error: REPLACE_RESTORE_DISABLED_MESSAGE }, { status: 400 }));
  }

  let payload;
  try {
    payload = parseBackupFile(parsed.data.backup);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 400 }));
  }

  try {
    const result = await importPublicTablesBackup(session.db, payload, parsed.data.mode);

    await logAdminActivity({
      action: "backup.full_restore",
      entityType: "database",
      entityId: null,
      details: {
        mode: result.mode,
        exportedAt: payload.manifest.exportedAt,
        tablesProcessed: result.tablesProcessed,
        rowsInserted: result.rowsInserted,
      },
    });

    return withCors(req, NextResponse.json({ ok: true, ...result }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
