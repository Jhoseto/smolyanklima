import { NextRequest, NextResponse } from "next/server";
import { adminSessionIfChatOperator } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await adminSessionIfChatOperator())) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createSupabaseServiceRoleClient();

  await supabase
    .from("live_chats")
    .update({ admin_typing_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
