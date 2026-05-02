import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/db";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabaseAdmin = await adminDb().catch(() => null);
  if (!supabaseAdmin) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

  const { id } = await params;
  const supabase = createSupabaseServiceRoleClient();

  await supabase
    .from("live_chats")
    .update({ admin_typing_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
