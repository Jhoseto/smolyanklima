import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

/** GET /api/admin/chat — list chats */
export async function GET(req: NextRequest) {
  const supabase = await adminDb().catch(() => null);
  if (!supabase) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? "";

  let query = supabase
    .from("live_chats")
    .select("id, visitor_name, visitor_email, visitor_phone, status, created_at, last_message_at, admin_notes");

  if (status) query = query.eq("status", status);

  const { data, error } = await query.order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
