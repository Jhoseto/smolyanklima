import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabaseAdmin = await adminDb().catch(() => null);
  if (!supabaseAdmin) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("chat_canned_responses")
    .select("id, shortcut, content, sort_order")
    .order("sort_order", { ascending: true });
  return NextResponse.json(data ?? []);
}
