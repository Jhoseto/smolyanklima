import { NextRequest, NextResponse } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await adminSessionIfChatOperator();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from("chat_canned_responses")
    .select("id, shortcut, content, sort_order")
    .order("sort_order", { ascending: true });
  return NextResponse.json(data ?? []);
}
