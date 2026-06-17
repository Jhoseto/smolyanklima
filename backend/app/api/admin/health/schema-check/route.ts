import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Проверява дали критични миграции са приложени (напр. 0091 photo_urls). */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 }));
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  const { error: photoErr } = await session.db
    .from("service_protocols")
    .select("photo_urls")
    .limit(1);

  checks.service_protocols_photo_urls = photoErr
    ? { ok: false, detail: photoErr.message }
    : { ok: true };

  const allOk = Object.values(checks).every(c => c.ok);

  return withCors(req, NextResponse.json({
    ok: allOk,
    checks,
    migrationHint: allOk
      ? null
      : "Приложете backend/supabase/migrations/0091_service_protocols_photos.sql в Supabase SQL Editor.",
  }));
}
