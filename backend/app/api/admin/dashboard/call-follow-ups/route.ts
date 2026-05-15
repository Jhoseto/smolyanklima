import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession } from "@/lib/admin/db";
import { fetchCallFollowUpPanelItems } from "@/lib/admin/call-follow-up-items";

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

  const items = await fetchCallFollowUpPanelItems(session.db);
  return withCors(req, NextResponse.json({ items }));
}
