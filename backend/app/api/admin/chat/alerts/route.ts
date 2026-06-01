import { NextResponse } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";
import { loadChatAlertSnapshot } from "@/lib/live-chat/chatAlertSnapshot";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat/alerts — snapshot за звукови известия (нов чат / ново user съобщение). */
export async function GET() {
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const snapshot = await loadChatAlertSnapshot(session.db);
    return NextResponse.json(snapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
