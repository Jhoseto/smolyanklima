import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { computeFleetSummary } from "@/lib/admin/fleetQueries";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
    requireFleetAccess(session);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_AUTHENTICATED") {
      return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
    }
    if (msg === "FORBIDDEN" || msg === "NOT_ADMIN") {
      return withCors(req, NextResponse.json({ error: "Нямате достъп до автопарка." }, { status: 403 }));
    }
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    const data = await computeFleetSummary(session.db);
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}
