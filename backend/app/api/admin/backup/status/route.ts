import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

const RPC_CHECKS: { name: string; migration: string; args?: Record<string, unknown> }[] = [
  { name: "admin_export_list_public_tables", migration: "0045 / 0068" },
  { name: "admin_backup_truncate_tables", migration: "0067", args: { table_names: [] } },
  { name: "admin_backup_reset_sequences", migration: "0067" },
];

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Проверка дали backup/restore RPC функциите са налични в Supabase. */
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
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const missing: string[] = [];
  const details: { name: string; migration: string; error?: string }[] = [];

  for (const check of RPC_CHECKS) {
    const { data, error } = check.args
      ? await session.db.rpc(check.name, check.args)
      : await session.db.rpc(check.name);
    if (error && isMissingFunction(error.message)) {
      missing.push(check.name);
      details.push({ name: check.name, migration: check.migration });
    } else if (error) {
      details.push({ name: check.name, migration: check.migration, error: error.message });
    } else if (check.name === "admin_export_list_public_tables" && !Array.isArray(data)) {
      details.push({
        name: check.name,
        migration: check.migration,
        error: "Unexpected RPC response — опитайте Supabase → Settings → API → Reload schema",
      });
    }
  }

  const onlyMissing = details.filter((d) => missing.includes(d.name));
  const migrationHint =
    onlyMissing.length > 0
      ? [...new Set(onlyMissing.map((d) => d.migration))].join(", ")
      : null;

  return withCors(
    req,
    NextResponse.json({
      ok: missing.length === 0 && !details.some((d) => d.error),
      missing,
      details,
      message:
        missing.length === 0 && !details.some((d) => d.error)
          ? "Backup и restore са готови."
          : missing.length > 0
            ? `Липсва RPC: ${missing.join(", ")}. Пуснете migration(s): ${migrationHint}.`
            : details.find((d) => d.error)?.error ?? "Backup проверката откри грешка.",
    }),
  );
}

function isMissingFunction(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("could not find the function") ||
    m.includes("pgrst202") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  );
}
